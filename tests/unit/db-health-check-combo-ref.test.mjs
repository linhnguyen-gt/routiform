import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-db-health-combo-ref-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const combosDb = await import("../../src/lib/db/combos.ts");
const { runDbHealthCheck } = await import("../../src/lib/db/healthCheck.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("runDbHealthCheck keeps valid legacy combo string references", async () => {
  await combosDb.createCombo({
    name: "gemini-combo",
    models: ["gemini/gemini-2.5-flash"],
    strategy: "priority",
    config: {},
  });

  await combosDb.createCombo({
    name: "parent-combo",
    models: ["gemini-combo"],
    strategy: "priority",
    config: {},
  });

  const db = core.getDbInstance();
  const result = runDbHealthCheck(db, { autoRepair: true, expectedSchemaVersion: "1" });
  assert.equal(result.isHealthy, true);
  assert.equal(result.repairedCount, 0);

  const parent = await combosDb.getComboByName("parent-combo");
  assert.deepEqual(parent?.models, ["gemini-combo"]);
});

test("runDbHealthCheck normalizes combo-ref objects to string refs", async () => {
  await combosDb.createCombo({
    name: "gemini-combo",
    models: ["gemini/gemini-2.5-flash"],
    strategy: "priority",
    config: {},
  });

  await combosDb.createCombo({
    name: "parent-combo",
    models: [{ kind: "combo-ref", comboName: "gemini-combo" }],
    strategy: "priority",
    config: {},
  });

  const db = core.getDbInstance();
  const result = runDbHealthCheck(db, { autoRepair: true, expectedSchemaVersion: "1" });
  assert.equal(result.isHealthy, false);
  assert.ok(result.repairedCount >= 1);

  const gemini = await combosDb.getComboByName("gemini-combo");
  assert.ok(gemini);

  const parent = await combosDb.getComboByName("parent-combo");
  assert.deepEqual(parent?.models, ["gemini-combo"]);
});
