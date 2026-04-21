import test from "node:test";
import assert from "node:assert/strict";

const { shouldFallbackComboBadRequest } = await import("../../open-sse/services/combo.ts");

test("combo bad-request fallback recognizes unsupported model responses", () => {
  assert.equal(
    shouldFallbackComboBadRequest(400, "[400]: The requested model is not supported.", "github"),
    true
  );
  assert.equal(shouldFallbackComboBadRequest(400, "Model gpt-x is not supported", "openai"), true);
  assert.equal(shouldFallbackComboBadRequest(400, "Improperly formed request.", "kiro"), true);
  assert.equal(
    shouldFallbackComboBadRequest(
      400,
      "The tool_choice parameter does not support being set to required or object in thinking mode",
      "qwen"
    ),
    true
  );
});

test("combo bad-request fallback ignores unrelated 400 errors", () => {
  assert.equal(shouldFallbackComboBadRequest(400, "Invalid tool schema payload", "github"), false);
  assert.equal(
    shouldFallbackComboBadRequest(422, "The requested model is not supported.", "github"),
    false
  );
});

test("combo bad-request fallback recognizes generic 'Provider returned error' 400", () => {
  assert.equal(
    shouldFallbackComboBadRequest(400, "[400]: Provider returned error", "github"),
    true
  );
  assert.equal(
    shouldFallbackComboBadRequest(
      400,
      "{'error': {'message': '[400]: Provider returned error', 'type': 'invalid_request_error', 'code': 'bad_request'}}",
      "openai"
    ),
    true
  );
});
