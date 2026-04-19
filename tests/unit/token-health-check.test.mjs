import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const tokenHealthCheck = await import("../../src/lib/tokenHealthCheck.ts");

test("buildRefreshFailureUpdate keeps active connections routable after refresh failure", () => {
  const now = "2026-04-09T04:40:00.000Z";

  const update = tokenHealthCheck.buildRefreshFailureUpdate(
    {
      testStatus: "active",
      expiredRetryCount: 2,
    },
    now
  );

  assert.equal(update.testStatus, "active");
  assert.equal(update.lastError, "Health check: token refresh failed");
  assert.equal(update.lastErrorType, "token_refresh_failed");
  assert.equal(update.lastErrorSource, "oauth");
  assert.equal(update.errorCode, "refresh_failed");
  assert.equal(update.lastHealthCheckAt, now);
  assert.equal("expiredRetryCount" in update, false);
  assert.equal("expiredRetryAt" in update, false);
});

test("buildRefreshFailureUpdate preserves expired retry tracking", () => {
  const now = "2026-04-09T04:41:00.000Z";

  const update = tokenHealthCheck.buildRefreshFailureUpdate(
    {
      testStatus: "expired",
      expiredRetryCount: 2,
    },
    now
  );

  assert.equal(update.testStatus, "expired");
  assert.equal(update.expiredRetryCount, 3);
  assert.equal(update.expiredRetryAt, now);
});

test("resolveTokenHealthCheckStaggerWindowMs clamps configured window to interval", () => {
  const original = process.env.ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC;

  process.env.ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC = "600";
  assert.equal(
    tokenHealthCheck.resolveTokenHealthCheckStaggerWindowMs(5 * 60 * 1000),
    5 * 60 * 1000
  );

  process.env.ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC = "30";
  assert.equal(tokenHealthCheck.resolveTokenHealthCheckStaggerWindowMs(5 * 60 * 1000), 30 * 1000);

  process.env.ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC = "-1";
  assert.equal(tokenHealthCheck.resolveTokenHealthCheckStaggerWindowMs(5 * 60 * 1000), 0);

  if (original === undefined) {
    delete process.env.ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC;
  } else {
    process.env.ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC = original;
  }
});

test("getDeterministicStaggerOffsetMs is stable and bounded", () => {
  const windowMs = 60_000;
  const a = tokenHealthCheck.getDeterministicStaggerOffsetMs("conn-a", windowMs);
  const b = tokenHealthCheck.getDeterministicStaggerOffsetMs("conn-a", windowMs);
  const c = tokenHealthCheck.getDeterministicStaggerOffsetMs("conn-b", windowMs);

  assert.equal(a, b);
  assert.ok(a >= 0 && a < windowMs);
  assert.ok(c >= 0 && c < windowMs);
  assert.notEqual(a, c);
});

test("shouldRunIntervalHealthCheck respects first-run staggering and pre-expiry bypass", () => {
  const schedulerStartedAtMs = 1_000;
  const intervalMs = 60_000;
  const staggerOffsetMs = 10_000;

  assert.equal(
    tokenHealthCheck.shouldRunIntervalHealthCheck({
      nowMs: 10_500,
      schedulerStartedAtMs,
      lastCheckMs: 0,
      intervalMs,
      staggerOffsetMs,
      isAboutToExpire: false,
    }),
    false
  );

  assert.equal(
    tokenHealthCheck.shouldRunIntervalHealthCheck({
      nowMs: 11_000,
      schedulerStartedAtMs,
      lastCheckMs: 0,
      intervalMs,
      staggerOffsetMs,
      isAboutToExpire: false,
    }),
    true
  );

  assert.equal(
    tokenHealthCheck.shouldRunIntervalHealthCheck({
      nowMs: 70_000,
      schedulerStartedAtMs,
      lastCheckMs: 20_000,
      intervalMs,
      staggerOffsetMs,
      isAboutToExpire: false,
    }),
    false
  );

  assert.equal(
    tokenHealthCheck.shouldRunIntervalHealthCheck({
      nowMs: 80_000,
      schedulerStartedAtMs,
      lastCheckMs: 20_000,
      intervalMs,
      staggerOffsetMs,
      isAboutToExpire: false,
    }),
    true
  );

  assert.equal(
    tokenHealthCheck.shouldRunIntervalHealthCheck({
      nowMs: 2_000,
      schedulerStartedAtMs,
      lastCheckMs: 20_000,
      intervalMs,
      staggerOffsetMs,
      isAboutToExpire: true,
    }),
    true
  );
});
