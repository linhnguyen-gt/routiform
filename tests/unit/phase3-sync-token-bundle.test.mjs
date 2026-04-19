import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-phase3-sync-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const settingsDb = await import("../../src/lib/db/settings.ts");
const providerDb = await import("../../src/lib/db/providers.ts");
const comboDb = await import("../../src/lib/db/combos.ts");
const apiKeysDb = await import("../../src/lib/db/apiKeys.ts");
const tokenRoute = await import("../../src/app/api/sync/tokens/route.ts");
const tokenByIdRoute = await import("../../src/app/api/sync/tokens/[id]/route.ts");
const bundleRoute = await import("../../src/app/api/sync/bundle/route.ts");

const ORIGINAL_INITIAL_PASSWORD = process.env.INITIAL_PASSWORD;

function withAuth(request) {
  return new Request(request.url, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers.entries()),
      Authorization: `Bearer ${request._apiKey}`,
    },
    body: request._body || undefined,
  });
}

async function resetStorage() {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  process.env.INITIAL_PASSWORD = "phase3-sync-test-password";
  await settingsDb.updateSettings({ requireLogin: true, password: "" });
}

async function createManagementApiKey() {
  const key = await apiKeysDb.createApiKey("phase3-management", "machine1234567890");
  return key.key;
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  if (ORIGINAL_INITIAL_PASSWORD === undefined) {
    delete process.env.INITIAL_PASSWORD;
  } else {
    process.env.INITIAL_PASSWORD = ORIGINAL_INITIAL_PASSWORD;
  }
});

test("phase3 sync tokens: management auth is required", async () => {
  const listResponse = await tokenRoute.GET(new Request("http://localhost/api/sync/tokens"));
  assert.equal(listResponse.status, 401);

  const createResponse = await tokenRoute.POST(
    new Request("http://localhost/api/sync/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "agent-a" }),
    })
  );
  assert.equal(createResponse.status, 401);
});

test("phase3 sync tokens: issue, list, get, revoke lifecycle", async () => {
  const managementApiKey = await createManagementApiKey();

  const issueReq = new Request("http://localhost/api/sync/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "agent-a" }),
  });
  issueReq._apiKey = managementApiKey;
  issueReq._body = JSON.stringify({ name: "agent-a" });

  const issueResponse = await tokenRoute.POST(withAuth(issueReq));
  assert.equal(issueResponse.status, 201);
  const issued = await issueResponse.json();
  assert.equal(issued.name, "agent-a");
  assert.match(issued.token, /^rst_/);
  assert.equal(typeof issued.tokenPrefix, "string");
  assert.equal(issued.tokenPrefix.length > 0, true);

  const listReq = new Request("http://localhost/api/sync/tokens");
  listReq._apiKey = managementApiKey;
  const listResponse = await tokenRoute.GET(withAuth(listReq));
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  assert.equal(listPayload.total, 1);
  assert.equal(listPayload.items[0].id, issued.id);
  assert.equal(Object.prototype.hasOwnProperty.call(listPayload.items[0], "tokenHash"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(listPayload.items[0], "token"), false);

  const getReq = new Request(`http://localhost/api/sync/tokens/${issued.id}`);
  getReq._apiKey = managementApiKey;
  const getResponse = await tokenByIdRoute.GET(withAuth(getReq), {
    params: Promise.resolve({ id: issued.id }),
  });
  assert.equal(getResponse.status, 200);
  const getPayload = await getResponse.json();
  assert.equal(getPayload.token.id, issued.id);
  assert.equal(Object.prototype.hasOwnProperty.call(getPayload.token, "tokenHash"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(getPayload.token, "token"), false);

  const revokeReq = new Request(`http://localhost/api/sync/tokens/${issued.id}`, {
    method: "DELETE",
  });
  revokeReq._apiKey = managementApiKey;
  const revokeResponse = await tokenByIdRoute.DELETE(withAuth(revokeReq), {
    params: Promise.resolve({ id: issued.id }),
  });
  assert.equal(revokeResponse.status, 200);

  const getAfterRevokeReq = new Request(`http://localhost/api/sync/tokens/${issued.id}`);
  getAfterRevokeReq._apiKey = managementApiKey;
  const getAfterRevoke = await tokenByIdRoute.GET(withAuth(getAfterRevokeReq), {
    params: Promise.resolve({ id: issued.id }),
  });
  assert.equal(getAfterRevoke.status, 200);
  const afterPayload = await getAfterRevoke.json();
  assert.equal(afterPayload.token.isActive, false);
});

test("phase3 sync bundle: bearer sync token auth and 200 then 304 etag flow", async () => {
  const managementApiKey = await createManagementApiKey();

  await providerDb.createProviderConnection({
    provider: "openai",
    authType: "apikey",
    name: "openai-main",
    apiKey: "provider-secret-key",
  });
  await comboDb.createCombo({
    name: "default",
    models: ["openai/gpt-4o-mini"],
    strategy: "priority",
  });

  const issueReq = new Request("http://localhost/api/sync/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "agent-b" }),
  });
  issueReq._apiKey = managementApiKey;
  issueReq._body = JSON.stringify({ name: "agent-b" });
  const issueResponse = await tokenRoute.POST(withAuth(issueReq));
  const issued = await issueResponse.json();

  const bundleUnauthorized = await bundleRoute.GET(new Request("http://localhost/api/sync/bundle"));
  assert.equal(bundleUnauthorized.status, 401);

  const firstBundle = await bundleRoute.GET(
    new Request("http://localhost/api/sync/bundle", {
      headers: { Authorization: `Bearer ${issued.token}` },
    })
  );
  assert.equal(firstBundle.status, 200);
  const firstEtag = firstBundle.headers.get("etag");
  assert.equal(typeof firstEtag, "string");
  const firstPayload = await firstBundle.json();
  const serializedPayload = JSON.stringify(firstPayload);

  assert.equal(Array.isArray(firstPayload.providers), true);
  assert.equal(Array.isArray(firstPayload.apiKeys), true);
  assert.equal(serializedPayload.includes("provider-secret-key"), false);
  assert.equal(firstPayload.apiKeys[0].key, "[REDACTED]");
  if (Object.prototype.hasOwnProperty.call(firstPayload.settings, "password")) {
    assert.equal(firstPayload.settings.password, "[REDACTED]");
  }

  const secondBundle = await bundleRoute.GET(
    new Request("http://localhost/api/sync/bundle", {
      headers: {
        Authorization: `Bearer ${issued.token}`,
        "If-None-Match": firstEtag,
      },
    })
  );
  assert.equal(secondBundle.status, 304);
  assert.equal(secondBundle.headers.get("etag"), firstEtag);
});
