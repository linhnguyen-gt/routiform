import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-compliance-audit-log-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const compliance = await import("../../src/lib/compliance/index.ts");

function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(() => {
  resetStorage();
  compliance.initAuditLog();
});

test.after(() => {
  resetStorage();
});

test("getAuditLog tolerates non-JSON details", () => {
  const db = core.getDbInstance();
  db.prepare("INSERT INTO audit_log (action, actor, details) VALUES (?, ?, ?)").run(
    "provider.connection.update",
    "dashboard",
    "plain-text-details"
  );

  const entries = compliance.getAuditLog({ limit: 10, offset: 0 });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].details, "plain-text-details");
});

test("getAuditLog clamps limit and offset", () => {
  const db = core.getDbInstance();
  db.prepare("INSERT INTO audit_log (action, actor, details) VALUES (?, ?, ?)").run(
    "provider.connection.create",
    "dashboard",
    JSON.stringify({ ok: true })
  );

  const entries = compliance.getAuditLog({ limit: -5, offset: -10 });
  assert.equal(entries.length, 1);
});

test("getAuditLog supports excluding actions and stable ordering", () => {
  const db = core.getDbInstance();
  db.prepare("INSERT INTO audit_log (action, actor, details) VALUES (?, ?, ?)").run(
    "compliance.audit_log.read",
    "dashboard",
    JSON.stringify({ n: 1 })
  );
  db.prepare("INSERT INTO audit_log (action, actor, details) VALUES (?, ?, ?)").run(
    "provider.connection.create",
    "dashboard",
    JSON.stringify({ n: 2 })
  );

  const entries = compliance.getAuditLog({
    limit: 10,
    offset: 0,
    excludeActions: ["compliance.audit_log.read"],
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].action, "provider.connection.create");
});
