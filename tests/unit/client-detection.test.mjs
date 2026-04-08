import test from "node:test";
import assert from "node:assert/strict";

const { isDroidCliUserAgent } = await import("../../open-sse/utils/clientDetection.ts");

test("client detection: detects codex-cli user agent", () => {
  assert.equal(isDroidCliUserAgent("codex-cli/0.92.0 (Windows 10.0.26100; x64)"), true);
});

test("client detection: detects droid-cli user agent", () => {
  assert.equal(isDroidCliUserAgent("droid-cli/1.2.3"), true);
});

test("client detection: does not treat generic android UA as droid cli", () => {
  const androidUa =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36";
  assert.equal(isDroidCliUserAgent(androidUa), false);
});

test("client detection: handles unknown user agent safely", () => {
  assert.equal(isDroidCliUserAgent(undefined), false);
  assert.equal(isDroidCliUserAgent(null), false);
  assert.equal(isDroidCliUserAgent(123), false);
});
