import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SignJWT } from "jose";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-phase3-sync-"));
const ORIGINAL_DATA_DIR = process.env.DATA_DIR;
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
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

function withManagementSession(url, sessionToken, method = "GET", body = null) {
  return new Request(url, {
    method,
    headers: {
      cookie: `auth_token=${sessionToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createManagementSessionToken() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

async function resetStorage() {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  process.env.JWT_SECRET = "phase3-sync-jwt-secret";
  process.env.INITIAL_PASSWORD = "phase3-sync-test-password";
  await settingsDb.updateSettings({ requireLogin: true, password: "" });
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  if (ORIGINAL_DATA_DIR === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  }
  if (ORIGINAL_JWT_SECRET === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  }
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
  const sessionToken = await createManagementSessionToken();

  const issueResponse = await tokenRoute.POST(
    withManagementSession("http://localhost/api/sync/tokens", sessionToken, "POST", {
      name: "agent-a",
    })
  );
  assert.equal(issueResponse.status, 201);
  const issued = await issueResponse.json();
  assert.equal(issued.name, "agent-a");
  assert.match(issued.token, /^rst_/);
  assert.equal(typeof issued.tokenPrefix, "string");
  assert.equal(issued.tokenPrefix.length > 0, true);

  const listResponse = await tokenRoute.GET(
    withManagementSession("http://localhost/api/sync/tokens", sessionToken)
  );
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  assert.equal(listPayload.total, 1);
  assert.equal(listPayload.items[0].id, issued.id);
  assert.equal(Object.prototype.hasOwnProperty.call(listPayload.items[0], "tokenHash"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(listPayload.items[0], "token"), false);

  const getResponse = await tokenByIdRoute.GET(
    withManagementSession(`http://localhost/api/sync/tokens/${issued.id}`, sessionToken),
    {
      params: Promise.resolve({ id: issued.id }),
    }
  );
  assert.equal(getResponse.status, 200);
  const getPayload = await getResponse.json();
  assert.equal(getPayload.token.id, issued.id);
  assert.equal(Object.prototype.hasOwnProperty.call(getPayload.token, "tokenHash"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(getPayload.token, "token"), false);

  const revokeResponse = await tokenByIdRoute.DELETE(
    withManagementSession(`http://localhost/api/sync/tokens/${issued.id}`, sessionToken, "DELETE"),
    {
      params: Promise.resolve({ id: issued.id }),
    }
  );
  assert.equal(revokeResponse.status, 200);

  const getAfterRevoke = await tokenByIdRoute.GET(
    withManagementSession(`http://localhost/api/sync/tokens/${issued.id}`, sessionToken),
    {
      params: Promise.resolve({ id: issued.id }),
    }
  );
  assert.equal(getAfterRevoke.status, 200);
  const afterPayload = await getAfterRevoke.json();
  assert.equal(afterPayload.token.isActive, false);
});

test("phase3 sync bundle: bearer sync token auth and 200 then 304 etag flow", async () => {
  const sessionToken = await createManagementSessionToken();

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
  await apiKeysDb.createApiKey("bundle-reader", "machine1234567890");

  const issueResponse = await tokenRoute.POST(
    withManagementSession("http://localhost/api/sync/tokens", sessionToken, "POST", {
      name: "agent-b",
    })
  );
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
