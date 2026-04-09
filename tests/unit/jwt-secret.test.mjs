import test from "node:test";
import assert from "node:assert/strict";

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

async function importFresh() {
  // Force re-import to get fresh state
  const modulePath = "../../src/shared/utils/jwtSecret.ts";
  const { getJwtSecret, clearJwtSecretCache, __resetJwtSecretCache } = await import(modulePath);
  __resetJwtSecretCache?.();
  return { getJwtSecret, clearJwtSecretCache, __resetJwtSecretCache };
}

test.beforeEach(async () => {
  // Reset env and module state before each test
  if (ORIGINAL_JWT_SECRET === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  }
});

test.after(() => {
  if (ORIGINAL_JWT_SECRET === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  }
});

test("getJwtSecret reads the latest process.env value on each call", async () => {
  const { __resetJwtSecretCache } = await importFresh();
  __resetJwtSecretCache();

  process.env.JWT_SECRET = "first-secret";
  const { getJwtSecret } = await import("../../src/shared/utils/jwtSecret.ts");

  assert.equal(Buffer.from(getJwtSecret()).toString("utf8"), "first-secret");

  process.env.JWT_SECRET = "second-secret";
  assert.equal(Buffer.from(getJwtSecret()).toString("utf8"), "second-secret");
});

test("getJwtSecret auto-generates secret when JWT_SECRET is blank", async () => {
  delete process.env.JWT_SECRET;
  const { __resetJwtSecretCache } = await importFresh();
  __resetJwtSecretCache();

  const { getJwtSecret } = await import("../../src/shared/utils/jwtSecret.ts");
  const secret = getJwtSecret();

  // Should return a Uint8Array (auto-generated, not null)
  assert.ok(secret instanceof Uint8Array);
  assert.ok(secret.length > 0);
});

test("getJwtSecret returns same cached secret when auto-generated", async () => {
  delete process.env.JWT_SECRET;
  const { __resetJwtSecretCache } = await importFresh();
  __resetJwtSecretCache();

  const { getJwtSecret } = await import("../../src/shared/utils/jwtSecret.ts");
  const secret1 = getJwtSecret();
  const secret2 = getJwtSecret();

  // Both should be the same cached value
  assert.deepEqual(secret1, secret2);
});

test("getJwtSecret picks up env changes after clearJwtSecretCache", async () => {
  delete process.env.JWT_SECRET;
  const { __resetJwtSecretCache } = await importFresh();
  __resetJwtSecretCache();

  const { getJwtSecret, clearJwtSecretCache } = await import("../../src/shared/utils/jwtSecret.ts");

  // First call auto-generates
  const autoSecret = getJwtSecret();
  assert.ok(autoSecret instanceof Uint8Array);

  // Set env and clear cache
  process.env.JWT_SECRET = "env-secret";
  clearJwtSecretCache();

  // Should now pick up env value
  const envSecret = getJwtSecret();
  assert.equal(Buffer.from(envSecret).toString("utf8"), "env-secret");
});
