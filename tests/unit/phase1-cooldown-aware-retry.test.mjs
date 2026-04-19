import test from "node:test";
import assert from "node:assert/strict";

const modulePath = "../../src/sse/services/cooldownAwareRetry.ts";

test("Phase1: cooldown-aware retry config defaults and overrides", async () => {
  const { buildCooldownAwareRetryConfig } = await import(modulePath);

  const defaults = buildCooldownAwareRetryConfig({});
  assert.equal(defaults.maxRetries, 0);
  assert.equal(defaults.maxRetryIntervalMs, 5000);

  const configured = buildCooldownAwareRetryConfig({
    requestRetry: 3,
    maxRetryIntervalSec: 9,
  });
  assert.equal(configured.maxRetries, 3);
  assert.equal(configured.maxRetryIntervalMs, 9000);
});

test("Phase1: shouldRetryOnCooldown honors status and limits", async () => {
  const { shouldRetryOnCooldown } = await import(modulePath);

  const config = { maxRetries: 2, maxRetryIntervalMs: 5000 };

  assert.equal(
    shouldRetryOnCooldown({ status: 429, cooldownMs: 2000, retryAttempt: 0, config }),
    true
  );
  assert.equal(
    shouldRetryOnCooldown({ status: 503, cooldownMs: 2000, retryAttempt: 1, config }),
    true
  );
  assert.equal(
    shouldRetryOnCooldown({ status: 400, cooldownMs: 2000, retryAttempt: 0, config }),
    false
  );
  assert.equal(
    shouldRetryOnCooldown({ status: 429, cooldownMs: 10000, retryAttempt: 0, config }),
    false
  );
  assert.equal(
    shouldRetryOnCooldown({ status: 429, cooldownMs: 2000, retryAttempt: 2, config }),
    false
  );
});
