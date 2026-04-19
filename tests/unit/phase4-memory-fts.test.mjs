import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-phase4-memory-fts-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const store = await import("../../src/lib/memory/store.ts");
const retrieval = await import("../../src/lib/memory/retrieval.ts");
const { MemoryType } = await import("../../src/lib/memory/types.ts");
const { verifyMemoryFts } = await import("../../src/lib/memory/verify.ts");

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

test("phase4 memory table compatibility view is writable", async () => {
  const db = core.getDbInstance();
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO memory (id, apiKeyId, sessionId, type, key, content, metadata, createdAt, updatedAt, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    "legacy-view-row",
    "key-legacy",
    "session-legacy",
    "factual",
    "legacy",
    "legacy memory content",
    JSON.stringify({ source: "legacy-view" }),
    now,
    now,
    null
  );

  const memory = await store.getMemory("legacy-view-row");
  assert.ok(memory);
  assert.equal(memory.apiKeyId, "key-legacy");
  assert.equal(memory.content, "legacy memory content");
});

test("phase4 semantic retrieval uses FTS MATCH indexing", async () => {
  await store.createMemory({
    apiKeyId: "key-semantic",
    sessionId: "s1",
    type: MemoryType.FACTUAL,
    key: "alpha",
    content: "alpha galaxy context note",
    metadata: {},
    expiresAt: null,
  });
  await store.createMemory({
    apiKeyId: "key-semantic",
    sessionId: "s1",
    type: MemoryType.FACTUAL,
    key: "beta",
    content: "beta unrelated timeline",
    metadata: {},
    expiresAt: null,
  });

  const results = await retrieval.retrieveMemories("key-semantic", {
    enabled: true,
    maxTokens: 2000,
    retrievalStrategy: "semantic",
    autoSummarize: false,
    persistAcrossModels: false,
    retentionDays: 30,
    scope: "apiKey",
    searchText: "galaxy",
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].content.includes("galaxy"), true);
});

test("phase4 hybrid retrieval merges semantic and recent memories", async () => {
  await store.createMemory({
    apiKeyId: "key-hybrid",
    sessionId: "s1",
    type: MemoryType.FACTUAL,
    key: "semantic-hit",
    content: "deployment rollback runbook",
    metadata: {},
    expiresAt: null,
  });
  await store.createMemory({
    apiKeyId: "key-hybrid",
    sessionId: "s1",
    type: MemoryType.PROCEDURAL,
    key: "recent-note",
    content: "latest standup note",
    metadata: {},
    expiresAt: null,
  });

  const results = await retrieval.retrieveMemories("key-hybrid", {
    enabled: true,
    maxTokens: 2000,
    retrievalStrategy: "hybrid",
    autoSummarize: false,
    persistAcrossModels: false,
    retentionDays: 30,
    scope: "apiKey",
    searchText: "rollback",
  });

  const contents = results.map((m) => m.content);
  assert.equal(
    contents.some((c) => c.includes("rollback")),
    true
  );
  assert.equal(
    contents.some((c) => c.includes("standup")),
    true
  );
});

test("phase4 fts index tracks insert/update/delete lifecycle", async () => {
  const created = await store.createMemory({
    apiKeyId: "key-lifecycle",
    sessionId: "s1",
    type: MemoryType.FACTUAL,
    key: "lifecycle",
    content: "initial phrase",
    metadata: {},
    expiresAt: null,
  });

  const db = core.getDbInstance();
  const beforeUpdate = Number(
    db
      .prepare("SELECT COUNT(*) AS count FROM memories_fts WHERE id = ? AND memories_fts MATCH ?")
      .get(created.id, "initial*").count || 0
  );
  assert.equal(beforeUpdate, 1);

  const updated = await store.updateMemory(created.id, { content: "updated phrase" });
  assert.equal(updated, true);

  const afterUpdateOldToken = Number(
    db
      .prepare("SELECT COUNT(*) AS count FROM memories_fts WHERE id = ? AND memories_fts MATCH ?")
      .get(created.id, "initial*").count || 0
  );
  const afterUpdateNewToken = Number(
    db
      .prepare("SELECT COUNT(*) AS count FROM memories_fts WHERE id = ? AND memories_fts MATCH ?")
      .get(created.id, "updated*").count || 0
  );
  assert.equal(afterUpdateOldToken, 0);
  assert.equal(afterUpdateNewToken, 1);

  const deleted = await store.deleteMemory(created.id);
  assert.equal(deleted, true);

  const afterDelete = Number(
    db.prepare("SELECT COUNT(*) AS count FROM memories_fts WHERE id = ?").get(created.id).count || 0
  );
  assert.equal(afterDelete, 0);
});

test("phase4 migration idempotence verification for memory fts", async () => {
  await store.createMemory({
    apiKeyId: "key-verify",
    sessionId: "s1",
    type: MemoryType.FACTUAL,
    key: "verify",
    content: "memory health probe",
    metadata: {},
    expiresAt: null,
  });

  const before = verifyMemoryFts();
  assert.equal(before.healthy, true);

  const db = core.getDbInstance();
  const appliedBefore = Number(
    db
      .prepare("SELECT COUNT(*) AS count FROM _routiform_migrations WHERE version IN ('021','022')")
      .get().count || 0
  );

  core.resetDbInstance();
  const dbAfterReset = core.getDbInstance();

  const after = verifyMemoryFts();
  assert.equal(after.healthy, true);
  const appliedAfter = Number(
    dbAfterReset
      .prepare("SELECT COUNT(*) AS count FROM _routiform_migrations WHERE version IN ('021','022')")
      .get().count || 0
  );

  assert.equal(appliedBefore, 2);
  assert.equal(appliedAfter, 2);
});
