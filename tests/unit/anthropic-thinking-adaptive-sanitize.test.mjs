import test from "node:test";
import assert from "node:assert/strict";

const { sanitizeAnthropicThinkingPayload } =
  await import("../../open-sse/translator/helpers/claudeHelper.ts");

test("sanitizeAnthropicThinkingPayload maps adaptive to enabled and adds budget_tokens", () => {
  const body = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
  };
  sanitizeAnthropicThinkingPayload(body);
  assert.equal(body.thinking.type, "enabled");
  assert.ok(typeof body.thinking.budget_tokens === "number");
  assert.ok(body.thinking.budget_tokens > 0);
  assert.ok(body.max_tokens > body.thinking.budget_tokens);
});

test("sanitizeAnthropicThinkingPayload leaves disabled thinking unchanged", () => {
  const body = { thinking: { type: "disabled" } };
  sanitizeAnthropicThinkingPayload(body);
  assert.deepEqual(body.thinking, { type: "disabled" });
});
