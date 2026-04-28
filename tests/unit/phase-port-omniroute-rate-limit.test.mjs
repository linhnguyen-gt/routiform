import test from "node:test";
import assert from "node:assert/strict";

const {
  enableRateLimitProtection,
  disableRateLimitProtection,
  updateFromHeaders,
  getLearnedLimits,
} = await import("../../open-sse/services/rateLimitManager.ts");
const { hasPerModelQuota } = await import("../../open-sse/services/accountFallback.ts");

test("port plan: hasPerModelQuota includes github", () => {
  assert.equal(hasPerModelQuota("github"), true);
  assert.equal(hasPerModelQuota("gemini"), true);
  assert.equal(typeof hasPerModelQuota("openai"), "boolean");
});

test("port plan: github limiter key is model-scoped", () => {
  const connectionId = `test-gh-${Date.now()}`;
  const model = "gpt-5.5";
  const headers = new Headers({
    "x-ratelimit-limit-requests": "120",
    "x-ratelimit-remaining-requests": "100",
    "x-ratelimit-reset-requests": "60",
  });

  enableRateLimitProtection(connectionId);
  updateFromHeaders("github", connectionId, headers, 200, model);

  const learned = getLearnedLimits();
  const expectedKey = `github:${connectionId}:${model}`;
  assert.ok(
    Object.prototype.hasOwnProperty.call(learned, expectedKey),
    `expected learned limits key ${expectedKey}`
  );

  disableRateLimitProtection(connectionId);
});
