import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-model-alias-seed-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const modelsDb = await import("../../src/lib/db/models.ts");
const modelDeprecation = await import("../../open-sse/services/modelDeprecation.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.afterEach(async () => {
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("seedKnownModelAliases inserts known seeds once and remains idempotent", async () => {
  const seeds = modelsDb.getStartupModelAliasSeeds();
  const first = await modelsDb.seedKnownModelAliases();

  assert.equal(first.inserted, Object.keys(seeds).length);
  assert.equal(first.existing, 0);
  assert.equal(first.total, Object.keys(seeds).length);

  const second = await modelsDb.seedKnownModelAliases();
  assert.equal(second.inserted, 0);
  assert.equal(second.existing, Object.keys(seeds).length);
  assert.equal(second.total, Object.keys(seeds).length);

  const aliases = await modelsDb.getModelAliases();
  for (const [alias, target] of Object.entries(seeds)) {
    assert.equal(aliases[alias], target);
  }
});

test("seedKnownModelAliases preserves existing custom alias targets", async () => {
  await modelsDb.setModelAlias("gpt-5-codex", "github/gpt-5.2-codex");

  const result = await modelsDb.seedKnownModelAliases();
  assert.ok(result.inserted < result.total);

  const aliases = await modelsDb.getModelAliases();
  assert.equal(aliases["gpt-5-codex"], "github/gpt-5.2-codex");
  assert.equal(aliases["gemini-3.1-pro-preview"], "gemini/gemini-3.1-pro");
});

test("startup model deprecation seeds strip provider prefixes", async () => {
  const seeds = modelsDb.getStartupModelDeprecationSeeds();
  assert.equal(seeds["gpt-5-codex"], "gpt-5.3-codex");
  assert.equal(seeds["gemini-3.1-pro-preview"], "gemini-3.1-pro");
});

test("startup seed and settings aliases merge with settings precedence", () => {
  const startupSeeds = modelsDb.getStartupModelDeprecationSeeds();
  modelDeprecation.setCustomAliases(startupSeeds);
  modelDeprecation.setCustomAliases({
    ...startupSeeds,
    "gpt-5-codex": "gpt-5.2-codex",
    "my-old-model": "my-new-model",
  });

  assert.equal(modelDeprecation.resolveModelAlias("gpt-5-codex"), "gpt-5.2-codex");
  assert.equal(modelDeprecation.resolveModelAlias("gemini-3.1-pro-preview"), "gemini-3.1-pro");
  assert.equal(modelDeprecation.resolveModelAlias("my-old-model"), "my-new-model");

  modelDeprecation.setCustomAliases({});
});
