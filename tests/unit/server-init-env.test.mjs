import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("server-init wires runtime env validation and secret bootstrap", () => {
  const source = fs.readFileSync(new URL("../../src/server-init.ts", import.meta.url), "utf8");

  assert.ok(source.includes("enforceRuntimeEnv"), "server-init should call enforceRuntimeEnv");
  assert.ok(
    source.includes("ensureServerSecrets"),
    "server-init should bootstrap required secrets"
  );
  assert.ok(source.includes("enforceSecrets"), "server-init should keep enforceSecrets guard");
});
