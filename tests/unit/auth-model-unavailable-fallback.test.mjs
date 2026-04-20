import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-auth-model-unavailable-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const auth = await import("../../src/sse/services/auth.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("markAccountUnavailable applies model-only lockout for unsupported model 400", async () => {
  await resetStorage();

  const conn = await providersDb.createProviderConnection({
    provider: "github",
    authType: "oauth",
    accessToken: "gho_test",
    refreshToken: "r_test",
    isActive: true,
    testStatus: "active",
  });

  const result = await auth.markAccountUnavailable(
    conn.id,
    400,
    "The requested model is not supported.",
    "github",
    "gpt-5.3-codex"
  );

  assert.equal(result.shouldFallback, true);
  assert.ok(result.cooldownMs > 0);

  const after = await providersDb.getProviderConnectionById(conn.id);
  assert.equal(after.testStatus, "active");
  assert.equal(after.rateLimitedUntil ?? null, null);
  assert.equal(after.lastErrorType, "model_unavailable");

  const blocked = await auth.getProviderCredentials("github", null, [conn.id], "gpt-5.3-codex");
  assert.equal(blocked, null);

  const otherModel = await auth.getProviderCredentials("github", null, [conn.id], "gpt-5.2");
  assert.ok(otherModel);
  assert.equal(otherModel.connectionId, conn.id);
});
