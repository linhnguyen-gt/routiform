import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SignJWT } from "jose";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-phase5-call-logs-"));
const ORIGINAL_DATA_DIR = process.env.DATA_DIR;
const ORIGINAL_RETENTION = process.env.CALL_LOG_RETENTION_DAYS;
const ORIGINAL_INITIAL_PASSWORD = process.env.INITIAL_PASSWORD;
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.CALL_LOG_RETENTION_DAYS = "7";
process.env.INITIAL_PASSWORD = "phase5-test-password";

const core = await import("../../src/lib/db/core.ts");
const settingsDb = await import("../../src/lib/db/settings.ts");
const apiKeysDb = await import("../../src/lib/db/apiKeys.ts");
const callLogs = await import("../../src/lib/usage/callLogs.ts");
const { migrateCallLogsToSummaryStorageMode } =
  await import("../../src/lib/usage/callLogsMigration.ts");
const migrationRoute = await import("../../src/app/api/logs/migration/call-logs-summary/route.ts");

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

async function resetStorage() {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  await settingsDb.updateSettings({
    requireLogin: true,
    password: "",
    call_log_summary_storage_enabled: false,
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

function withManagementSession(url, sessionToken, body = null) {
  return new Request(url, {
    method: "POST",
    headers: {
      cookie: `auth_token=${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test.beforeEach(async () => {
  process.env.JWT_SECRET = "phase5-migration-jwt-secret";
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  if (ORIGINAL_JWT_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  if (ORIGINAL_INITIAL_PASSWORD === undefined) delete process.env.INITIAL_PASSWORD;
  else process.env.INITIAL_PASSWORD = ORIGINAL_INITIAL_PASSWORD;
  if (ORIGINAL_DATA_DIR === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  if (ORIGINAL_RETENTION === undefined) delete process.env.CALL_LOG_RETENTION_DAYS;
  else process.env.CALL_LOG_RETENTION_DAYS = ORIGINAL_RETENTION;
});

test("phase5 dry-run migration reports candidates safely", async () => {
  await callLogs.saveCallLog({
    id: "phase5-dry-1",
    timestamp: "2026-04-18T10:00:00.000Z",
    method: "POST",
    path: "/v1/chat/completions",
    status: 200,
    model: "openai/gpt-4.1",
    requestedModel: "openai/gpt-5",
    provider: "openai",
    duration: 21,
    requestBody: { messages: [{ role: "user", content: "hello" }] },
    responseBody: { ok: true },
  });

  await settingsDb.updateSettings({ call_log_summary_storage_enabled: true });
  const result = migrateCallLogsToSummaryStorageMode({ dryRun: true, limit: 100 });

  assert.equal(result.candidateRows >= 1, true);
  assert.equal(result.migratedRows, 0);
});

test("phase5 non-dry migration clears inline bodies but keeps detail via artifact fallback", async () => {
  await callLogs.saveCallLog({
    id: "phase5-live-1",
    timestamp: "2026-04-18T11:00:00.000Z",
    method: "POST",
    path: "/v1/chat/completions",
    status: 200,
    model: "openai/gpt-4.1",
    requestedModel: "openai/gpt-5",
    provider: "openai",
    duration: 30,
    requestBody: { messages: [{ role: "user", content: "who are you" }] },
    responseBody: { choices: [{ message: { content: "assistant" } }] },
  });

  await settingsDb.updateSettings({ call_log_summary_storage_enabled: true });
  const migrated = migrateCallLogsToSummaryStorageMode({ dryRun: false, limit: 100 });
  assert.equal(migrated.migratedRows >= 1, true);

  const db = core.getDbInstance();
  const row = db
    .prepare("SELECT request_body, response_body, error FROM call_logs WHERE id = ?")
    .get("phase5-live-1");
  assert.equal(String(row.request_body).includes('"_artifactOnly":true'), true);
  assert.equal(String(row.response_body).includes('"_artifactOnly":true'), true);
  assert.equal(row.error, null);

  const detail = await callLogs.getCallLogById("phase5-live-1");
  assert.equal(detail?.requestBody?.messages?.[0]?.content, "who are you");
  assert.equal(detail?.responseBody?.choices?.[0]?.message?.content, "assistant");
});

test("phase5 summary storage mode writes sentinel in list while preserving detail endpoint", async () => {
  await settingsDb.updateSettings({ call_log_summary_storage_enabled: true });

  await callLogs.saveCallLog({
    id: "phase5-write-1",
    timestamp: "2026-04-18T12:00:00.000Z",
    method: "POST",
    path: "/v1/chat/completions",
    status: 200,
    model: "openai/gpt-4.1",
    requestedModel: "openai/gpt-5",
    provider: "openai",
    duration: 15,
    requestBody: { messages: [{ role: "user", content: "test sentinel" }] },
    responseBody: { ok: true },
  });

  const list = await callLogs.getCallLogs({ limit: 5 });
  assert.equal(list.length, 1);
  assert.equal(list[0].hasRequestBody, false);
  assert.equal(list[0].hasResponseBody, false);

  const detail = await callLogs.getCallLogById("phase5-write-1");
  assert.equal(detail?.requestBody?.messages?.[0]?.content, "test sentinel");
  assert.equal(detail?.responseBody?.ok, true);
});

test("phase5 migration API requires management auth and returns guarded checklist", async () => {
  const unauthorized = await migrationRoute.POST(
    new Request("http://localhost/api/logs/migration/call-logs-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true }),
    })
  );
  assert.equal(unauthorized.status, 401);

  await settingsDb.updateSettings({ call_log_summary_storage_enabled: true });
  const sessionToken = await createManagementSessionToken();
  const authorized = await migrationRoute.POST(
    withManagementSession("http://localhost/api/logs/migration/call-logs-summary", sessionToken, {
      dryRun: true,
      limit: 50,
    })
  );
  assert.equal(authorized.status, 200);
  const body = await authorized.json();
  assert.equal(Array.isArray(body.doBeforeRelease), true);
  assert.equal(body.doBeforeRelease.length > 0, true);
});
