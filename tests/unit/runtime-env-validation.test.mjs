import test from "node:test";
import assert from "node:assert/strict";

const { validateRuntimeEnv, enforceRuntimeEnv } =
  await import("../../src/lib/runtime/envValidation.ts");

function withEnv(overrides, fn) {
  const originalEnv = { ...process.env };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
  }
}

test("validateRuntimeEnv accepts valid baseline env", () => {
  const result = validateRuntimeEnv({
    NODE_ENV: "production",
    STORAGE_DRIVER: "sqlite",
    PORT: "20128",
    REQUIRE_API_KEY: "false",
    PROVIDER_LIMITS_SYNC_INTERVAL_MINUTES: "70",
  });

  assert.equal(result.errors.length, 0);
});

test("validateRuntimeEnv rejects invalid port and invalid boolean", () => {
  const result = validateRuntimeEnv({
    PORT: "70000",
    REQUIRE_API_KEY: "maybe",
  });

  assert.ok(result.errors.some((issue) => issue.key === "PORT"));
  assert.ok(result.errors.some((issue) => issue.key === "REQUIRE_API_KEY"));
});

test("validateRuntimeEnv warns for legacy boolean literals on strict keys", () => {
  const result = validateRuntimeEnv({
    REQUIRE_API_KEY: "1",
    AUTH_COOKIE_SECURE: "on",
    PRICING_SYNC_ENABLED: "yes",
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((issue) => issue.key === "REQUIRE_API_KEY"));
  assert.ok(result.warnings.some((issue) => issue.key === "AUTH_COOKIE_SECURE"));
  assert.ok(result.warnings.some((issue) => issue.key === "PRICING_SYNC_ENABLED"));
});

test("validateRuntimeEnv keeps DISABLE_SQLITE_AUTO_BACKUP backward-compatible", () => {
  const result = validateRuntimeEnv({
    DISABLE_SQLITE_AUTO_BACKUP: "1",
  });

  assert.equal(result.errors.length, 0);
});

test("validateRuntimeEnv warns (not errors) for non-standard NODE_ENV", () => {
  const result = validateRuntimeEnv({
    NODE_ENV: "staging",
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((issue) => issue.key === "NODE_ENV"));
});

test("validateRuntimeEnv rejects invalid non-negative integer envs", () => {
  const result = validateRuntimeEnv({
    ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC: "1.5",
    SHUTDOWN_TIMEOUT_MS: "abc",
  });

  assert.ok(
    result.errors.some((issue) => issue.key === "ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC")
  );
  assert.ok(result.errors.some((issue) => issue.key === "SHUTDOWN_TIMEOUT_MS"));
});

test("validateRuntimeEnv warns when stagger env aliases conflict", () => {
  const result = validateRuntimeEnv({
    ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC: "30",
    TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC: "45",
  });

  assert.equal(result.errors.length, 0);
  assert.ok(
    result.warnings.some((issue) => issue.key === "ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC")
  );
});

test("enforceRuntimeEnv throws on invalid configuration", () => {
  const logs = [];
  const logger = {
    warn: (msg) => logs.push(`warn:${String(msg)}`),
    error: (msg) => logs.push(`error:${String(msg)}`),
  };

  assert.throws(
    () =>
      enforceRuntimeEnv(logger, {
        PORT: "-1",
      }),
    /Invalid runtime environment configuration/
  );

  assert.ok(logs.some((line) => line.includes("[ENV] PORT")));
});

test("enforceRuntimeEnv does not throw for valid configuration", () => {
  const logger = { warn: () => {}, error: () => {} };
  assert.doesNotThrow(() =>
    enforceRuntimeEnv(logger, {
      NODE_ENV: "development",
      STORAGE_DRIVER: "sqlite",
      PORT: "20128",
      REQUIRE_API_KEY: "false",
      SHUTDOWN_TIMEOUT_MS: "30000",
    })
  );
});

test("enforceRuntimeEnv reads process.env when no env argument is provided", () => {
  withEnv(
    {
      PORT: "20128",
      REQUIRE_API_KEY: "false",
      SHUTDOWN_TIMEOUT_MS: "1000",
      NODE_ENV: "production",
      STORAGE_DRIVER: "sqlite",
    },
    () => {
      const logger = { warn: () => {}, error: () => {} };
      assert.doesNotThrow(() => enforceRuntimeEnv(logger));
    }
  );
});
