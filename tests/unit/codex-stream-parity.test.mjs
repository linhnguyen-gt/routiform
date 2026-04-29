import test from "node:test";
import assert from "node:assert/strict";

const { CodexExecutor } = await import("../../open-sse/executors/codex.ts");

test("CodexExecutor maps legacy reasoning effort max to xhigh", () => {
  const executor = new CodexExecutor();
  const transformed = executor.transformRequest(
    "gpt-5.3-codex",
    {
      model: "gpt-5.3-codex",
      input: [{ role: "user", content: "hi" }],
      reasoning: { effort: "max" },
    },
    true,
    {}
  );
  assert.equal(transformed.reasoning?.effort, "xhigh");
});

test("CodexExecutor preserves previous_response_id when input is empty", () => {
  const executor = new CodexExecutor();
  const transformed = executor.transformRequest(
    "gpt-5.3-codex",
    {
      model: "gpt-5.3-codex",
      input: [],
      previous_response_id: "resp_abc123",
    },
    true,
    {}
  );
  assert.equal(transformed.previous_response_id, "resp_abc123");
});

test("CodexExecutor strips previous_response_id when input has messages", () => {
  const executor = new CodexExecutor();
  const transformed = executor.transformRequest(
    "gpt-5.3-codex",
    {
      model: "gpt-5.3-codex",
      input: [{ role: "user", content: "hi" }],
      previous_response_id: "resp_abc123",
    },
    true,
    {}
  );
  assert.equal(transformed.previous_response_id, undefined);
});
