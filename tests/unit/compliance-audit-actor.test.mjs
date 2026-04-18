import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SignJWT } from "jose";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-compliance-audit-actor-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const apiKeys = await import("../../src/lib/db/apiKeys.ts");
const compliance = await import("../../src/lib/compliance/index.ts");

function resetStorage() {
  core.resetDbInstance();
  apiKeys.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(() => {
  resetStorage();
});

test.after(() => {
  resetStorage();
});

test("getAuditActorFromRequest maps valid bearer auth to api_key actor", async () => {
  const created = await apiKeys.createApiKey("audit-actor", "machine-1");
  const request = new Request("http://localhost/test", {
    headers: {
      authorization: `bearer ${created.key}`,
    },
  });

  assert.equal(await compliance.getAuditActorFromRequest(request), "api_key");
});

test("getAuditActorFromRequest treats x-api-key alone as dashboard actor", async () => {
  const request = new Request("http://localhost/test", {
    headers: {
      "x-api-key": "rk-test",
    },
  });

  assert.equal(await compliance.getAuditActorFromRequest(request), "dashboard");
});

test("getAuditActorFromRequest treats auth cookie as dashboard actor", async () => {
  const request = new Request("http://localhost/test", {
    headers: {
      cookie: "auth_token=session-token",
    },
  });

  assert.equal(await compliance.getAuditActorFromRequest(request), "dashboard");
});

test("getAuditActorFromRequest prefers dashboard actor when bearer token is invalid", async () => {
  const request = new Request("http://localhost/test", {
    headers: {
      authorization: "Bearer invalid-token",
      cookie: "auth_token=session-token",
    },
  });

  assert.equal(await compliance.getAuditActorFromRequest(request), "dashboard");
});

test("getAuditActorFromRequest prefers dashboard when both cookie and bearer are valid", async () => {
  process.env.JWT_SECRET = "audit-test-secret";
  const created = await apiKeys.createApiKey("audit-actor-both", "machine-2");
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));

  const request = new Request("http://localhost/test", {
    headers: {
      authorization: `Bearer ${created.key}`,
      cookie: `auth_token=${token}`,
    },
  });

  assert.equal(await compliance.getAuditActorFromRequest(request), "dashboard");
});

test("getAuditActorFromRequest defaults to dashboard actor", async () => {
  const request = new Request("http://localhost/test");

  assert.equal(await compliance.getAuditActorFromRequest(request), "dashboard");
});

test("getAuditActorFromRequest tolerates malformed auth cookie encoding", async () => {
  const request = new Request("http://localhost/test", {
    headers: {
      cookie: "auth_token=%E0%A4%A",
    },
  });

  assert.equal(await compliance.getAuditActorFromRequest(request), "dashboard");
});
