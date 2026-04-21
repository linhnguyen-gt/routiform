import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SignJWT } from "jose";

const ORIGINAL_DATA_DIR = process.env.DATA_DIR;
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-management-auth-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const { requireManagementAuth } = await import("../../src/lib/api/requireManagementAuth.ts");
const { updateSettings } = await import("../../src/lib/localDb.ts");
const dbCore = await import("../../src/lib/db/core.ts");

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;
const ORIGINAL_INITIAL_PASSWORD = process.env.INITIAL_PASSWORD;

async function createSessionToken(secretValue) {
  const secret = new TextEncoder().encode(secretValue);
  return await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

test.beforeEach(async () => {
  dbCore.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  process.env.JWT_SECRET = "management-auth-test-secret";
  process.env.INITIAL_PASSWORD = "management-auth-bootstrap";
  await updateSettings({ requireLogin: true, password: "hashed-password" });
});

test.after(() => {
  dbCore.resetDbInstance();
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

test("requireManagementAuth rejects bearer API keys for management routes", async () => {
  const request = new Request("https://example.com/api/providers", {
    headers: { authorization: "Bearer sk-valid-looking" },
  });

  const response = await requireManagementAuth(request);

  assert.ok(response);
  assert.equal(response.status, 401);
});

test("requireManagementAuth accepts valid dashboard session cookie", async () => {
  const token = await createSessionToken(process.env.JWT_SECRET);
  const request = new Request("https://example.com/api/providers", {
    headers: { cookie: `auth_token=${token}` },
  });

  const response = await requireManagementAuth(request);

  assert.equal(response, null);
});

test("requireManagementAuth rejects invalid dashboard session cookie", async () => {
  const request = new Request("https://example.com/api/providers", {
    headers: { cookie: "auth_token=invalid.jwt.token" },
  });

  const response = await requireManagementAuth(request);

  assert.ok(response);
  assert.equal(response.status, 401);
});

test("requireManagementAuth bypasses checks when auth is disabled", async () => {
  await updateSettings({ requireLogin: false, password: "" });
  delete process.env.INITIAL_PASSWORD;

  const request = new Request("https://example.com/api/providers");
  const response = await requireManagementAuth(request);

  assert.equal(response, null);
});
