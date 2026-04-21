import test from "node:test";
import assert from "node:assert/strict";

const { isNativeSqliteLoadFailure } = await import("../../src/lib/db/core.ts");

test("isNativeSqliteLoadFailure matches known ABI load signatures", () => {
  assert.equal(
    isNativeSqliteLoadFailure(
      new Error("Module did not self-register"),
      "Module did not self-register"
    ),
    true
  );
  assert.equal(
    isNativeSqliteLoadFailure(
      new Error("ERR_DLOPEN_FAILED: symbol missing"),
      "ERR_DLOPEN_FAILED: symbol missing"
    ),
    true
  );
  assert.equal(
    isNativeSqliteLoadFailure(
      new Error("native module could not be found"),
      "native module could not be found"
    ),
    true
  );

  const codedError = new Error("something else");
  codedError.code = "ERR_DLOPEN_FAILED";
  assert.equal(isNativeSqliteLoadFailure(codedError, "something else"), true);
});

test("isNativeSqliteLoadFailure ignores ordinary sqlite probe errors", () => {
  assert.equal(
    isNativeSqliteLoadFailure(
      new Error("database disk image is malformed"),
      "database disk image is malformed"
    ),
    false
  );
  assert.equal(
    isNativeSqliteLoadFailure(
      new Error("SQLITE_BUSY: database is locked"),
      "SQLITE_BUSY: database is locked"
    ),
    false
  );
});
