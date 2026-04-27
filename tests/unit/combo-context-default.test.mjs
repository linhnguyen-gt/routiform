import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONTEXT_CONFIG } from "../../src/shared/constants/context.ts";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-combo-context-default-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const combosDb = await import("../../src/lib/db/combos.ts");

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

test("createCombo defaults context_length to CONTEXT_CONFIG.defaultLimit", async () => {
  const combo = await combosDb.createCombo({
    name: "ctx-default",
    models: [{ provider: "openai", model: "gpt-4o-mini" }],
    strategy: "priority",
    config: {},
  });

  assert.equal(combo.context_length, CONTEXT_CONFIG.defaultLimit);

  const fetchedByName = await combosDb.getComboByName("ctx-default");
  assert.equal(fetchedByName?.context_length, CONTEXT_CONFIG.defaultLimit);
});

test("createCombo preserves explicit context_length", async () => {
  const combo = await combosDb.createCombo({
    name: "ctx-custom",
    models: [{ provider: "openai", model: "gpt-4.1" }],
    strategy: "priority",
    config: {},
    context_length: 500000,
  });

  assert.equal(combo.context_length, 500000);

  const all = await combosDb.getCombos();
  const found = all.find((item) => item.name === "ctx-custom");
  assert.equal(found?.context_length, 500000);
});
