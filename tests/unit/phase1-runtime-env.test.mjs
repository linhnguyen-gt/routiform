import test from "node:test";
import assert from "node:assert/strict";

test("Phase1: runtime env permissive mode logs invalid timeout values", async () => {
  const messages = [];
  const { getRuntimeEnvConfig } = await import("../../src/lib/env/runtimeEnv.ts");

  const config = getRuntimeEnvConfig(
    {
      REQUEST_TIMEOUT_MS: "abc",
      STREAM_IDLE_TIMEOUT_MS: "600000",
      FETCH_HEADERS_TIMEOUT_MS: "-1",
    },
    (msg) => messages.push(msg)
  );

  assert.equal(config.strict, false);
  assert.equal(config.streamIdleTimeoutMs, 600000);
  assert.ok(messages.some((msg) => msg.includes("Invalid timeout env values")));
});

test("Phase1: runtime env strict mode throws on invalid timeout values", async () => {
  const { getRuntimeEnvConfig } = await import("../../src/lib/env/runtimeEnv.ts");

  assert.throws(
    () =>
      getRuntimeEnvConfig({
        RUNTIME_ENV_STRICT: "true",
        REQUEST_TIMEOUT_MS: "bad-value",
      }),
    /Invalid timeout env values/
  );
});
