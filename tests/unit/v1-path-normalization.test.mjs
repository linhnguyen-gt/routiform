import test from "node:test";
import assert from "node:assert/strict";

test("next.config rewrites /v1/v1/:path* to /api/v1/:path*", async () => {
  const { default: config } = await import("../../next.config.mjs");
  const rewriteGroups = await config.rewrites();
  const rewrites = Array.isArray(rewriteGroups)
    ? rewriteGroups
    : [
        ...(rewriteGroups.beforeFiles ?? []),
        ...(rewriteGroups.afterFiles ?? []),
        ...(rewriteGroups.fallback ?? []),
      ];
  const doubleV1 = rewrites.find((r) => r.source === "/v1/v1/:path*");
  assert.ok(doubleV1, "rewrite rule for /v1/v1/:path* must exist");
  assert.equal(doubleV1.destination, "/api/v1/:path*");
});

test("next.config rewrites /v1/v1 (no path) to /api/v1", async () => {
  const { default: config } = await import("../../next.config.mjs");
  const rewriteGroups = await config.rewrites();
  const rewrites = Array.isArray(rewriteGroups)
    ? rewriteGroups
    : [
        ...(rewriteGroups.beforeFiles ?? []),
        ...(rewriteGroups.afterFiles ?? []),
        ...(rewriteGroups.fallback ?? []),
      ];
  const doubleV1Bare = rewrites.find((r) => r.source === "/v1/v1");
  assert.ok(doubleV1Bare, "rewrite rule for /v1/v1 (bare) must exist");
  assert.equal(doubleV1Bare.destination, "/api/v1");
});
