import test from "node:test";
import assert from "node:assert/strict";

const { cacheReasoningFromAssistantMessage, lookupReasoning, requiresReasoningReplay } =
  await import("../../open-sse/services/reasoningCache.ts");

test("port plan: reasoning replay caches and replays by tool_call_id", () => {
  const prev = process.env.ROUTIFORM_REASONING_REPLAY;
  process.env.ROUTIFORM_REASONING_REPLAY = "1";

  try {
    const toolCallId = `call_${Date.now()}`;
    const cached = cacheReasoningFromAssistantMessage(
      {
        role: "assistant",
        tool_calls: [
          { id: toolCallId, type: "function", function: { name: "x", arguments: "{}" } },
        ],
        reasoning_content: "internal trace",
      },
      "deepseek",
      "deepseek-chat"
    );
    assert.equal(cached, 1);
    assert.equal(lookupReasoning(toolCallId, "deepseek", "deepseek-chat"), "internal trace");
  } finally {
    if (prev === undefined) delete process.env.ROUTIFORM_REASONING_REPLAY;
    else process.env.ROUTIFORM_REASONING_REPLAY = prev;
  }
});

test("port plan: requiresReasoningReplay detects configured providers/models", () => {
  assert.equal(requiresReasoningReplay("deepseek", "any"), true);
  assert.equal(requiresReasoningReplay("openai", "kimi-k2"), true);
  assert.equal(requiresReasoningReplay("openai", "gpt-4o"), false);
});

test("port plan: reasoning replay is scoped by provider+model", () => {
  const prev = process.env.ROUTIFORM_REASONING_REPLAY;
  process.env.ROUTIFORM_REASONING_REPLAY = "1";

  try {
    const toolCallId = `call_scope_${Date.now()}`;
    cacheReasoningFromAssistantMessage(
      {
        role: "assistant",
        tool_calls: [{ id: toolCallId }],
        reasoning_content: "deepseek only",
      },
      "deepseek",
      "deepseek-chat"
    );

    assert.equal(lookupReasoning(toolCallId, "deepseek", "deepseek-chat"), "deepseek only");
    assert.equal(lookupReasoning(toolCallId, "openai", "gpt-4o"), null);
  } finally {
    if (prev === undefined) delete process.env.ROUTIFORM_REASONING_REPLAY;
    else process.env.ROUTIFORM_REASONING_REPLAY = prev;
  }
});
