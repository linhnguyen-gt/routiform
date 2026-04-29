import test from "node:test";
import assert from "node:assert/strict";

const { stripEmbeddedAnthropicBillingLines } =
  await import("../../open-sse/services/claudeCodeCompatible.ts");

test("stripEmbeddedAnthropicBillingLines removes x-anthropic-billing-header lines", () => {
  const raw = "system primer\n  x-anthropic-billing-header: cc_version=1\nfooter";
  const out = stripEmbeddedAnthropicBillingLines(raw);
  assert.ok(!out.includes("x-anthropic-billing-header"));
  assert.ok(out.includes("system primer"));
  assert.ok(out.includes("footer"));
});

test("stripEmbeddedAnthropicBillingLines tolerates empty input", () => {
  assert.equal(stripEmbeddedAnthropicBillingLines(""), "");
});
