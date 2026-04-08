import test from "node:test";
import assert from "node:assert/strict";

const { getLoggedInputTokens } = await import("../../src/lib/usage/tokenAccounting.ts");

test("token accounting: anthropic input_tokens includes cache read/write", () => {
  const usage = {
    input_tokens: 3,
    cache_read_input_tokens: 113000,
    cache_creation_input_tokens: 613,
  };

  assert.equal(getLoggedInputTokens(usage), 113616);
});

test("token accounting: direct input field still has highest priority", () => {
  const usage = {
    input: 42,
    input_tokens: 100,
    cache_read_input_tokens: 10,
    cache_creation_input_tokens: 10,
  };

  assert.equal(getLoggedInputTokens(usage), 42);
});

test("token accounting: falls back to prompt_tokens when input_tokens missing", () => {
  const usage = {
    prompt_tokens: 256,
    cache_read_input_tokens: 999,
  };

  assert.equal(getLoggedInputTokens(usage), 256);
});
