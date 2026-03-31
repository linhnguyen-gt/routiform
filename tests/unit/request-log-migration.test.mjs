import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-log-migration-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const migrations = await import("../../src/lib/usage/migrations.ts");

const LEGACY_LOGS_DIR = path.join(TEST_DATA_DIR, "logs");
const LEGACY_CALL_LOGS_DIR = path.join(TEST_DATA_DIR, "call_logs");
const LEGACY_SUMMARY_FILE = path.join(TEST_DATA_DIR, "log.txt");
const MARKER_PATH = path.join(migrations.LOG_ARCHIVES_DIR, "legacy-request-logs.json");

function resetDataDir() {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

function seedLegacyLayout() {
  fs.mkdirSync(path.join(LEGACY_LOGS_DIR, "session-a"), { recursive: true });
  fs.writeFileSync(
    path.join(LEGACY_LOGS_DIR, "session-a", "1_req_client.json"),
    JSON.stringify({ ok: true }, null, 2)
  );

  fs.mkdirSync(path.join(LEGACY_CALL_LOGS_DIR, "2026-03-30"), { recursive: true });
  fs.writeFileSync(
    path.join(LEGACY_CALL_LOGS_DIR, "2026-03-30", "123000_model_200.json"),
    JSON.stringify({ ok: true }, null, 2)
  );

  fs.writeFileSync(LEGACY_SUMMARY_FILE, "legacy summary\n");
}

test.beforeEach(() => {
  resetDataDir();
});

test.after(() => {
  resetDataDir();
});

test("archives legacy request log layout into a zip and removes old files", async () => {
  seedLegacyLayout();

  const archiveFilename = await migrations.archiveLegacyRequestLogs();

  assert.match(archiveFilename || "", /_legacy-request-logs\.zip$/);
  assert.equal(fs.existsSync(LEGACY_LOGS_DIR), false);
  assert.equal(fs.existsSync(LEGACY_CALL_LOGS_DIR), false);
  assert.equal(fs.existsSync(LEGACY_SUMMARY_FILE), false);
  assert.equal(fs.existsSync(MARKER_PATH), true);

  const archivePath = path.join(migrations.LOG_ARCHIVES_DIR, archiveFilename);
  assert.equal(fs.existsSync(archivePath), true);
  assert.ok(fs.statSync(archivePath).size > 0);
});

test("keeps legacy files in place when zip creation fails", async () => {
  seedLegacyLayout();
  fs.writeFileSync(migrations.LOG_ARCHIVES_DIR, "not-a-directory");

  await assert.rejects(() => migrations.archiveLegacyRequestLogs());

  assert.equal(fs.existsSync(LEGACY_LOGS_DIR), true);
  assert.equal(fs.existsSync(LEGACY_CALL_LOGS_DIR), true);
  assert.equal(fs.existsSync(LEGACY_SUMMARY_FILE), true);
  assert.equal(fs.existsSync(MARKER_PATH), false);
});
