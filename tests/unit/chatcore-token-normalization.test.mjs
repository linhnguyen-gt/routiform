/**
 * Unit tests for token field normalization in chatCore.ts (#1321)
 *
 * The normalization block runs on `body` right before translation:
 *   - Responses API target  → must use max_output_tokens
 *   - All other targets     → must use max_tokens
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

const OPENAI_RESPONSES = "openai-responses";
const OPENAI = "openai";

/**
 * Pure replica of the normalization block in chatCore.ts (lines 507-523).
 * Kept in sync manually; if chatCore changes, update here too.
 */
function normalizeTokenFields(body, targetFormat) {
  body = { ...body }; // shallow clone — do not mutate caller's object
  if (targetFormat === OPENAI_RESPONSES) {
    if (body.max_tokens !== undefined && body.max_output_tokens === undefined) {
      body.max_output_tokens = body.max_tokens;
      delete body.max_tokens;
    }
    if (body.max_completion_tokens !== undefined && body.max_output_tokens === undefined) {
      body.max_output_tokens = body.max_completion_tokens;
      delete body.max_completion_tokens;
    }
  } else {
    if (body.max_output_tokens !== undefined && body.max_tokens === undefined) {
      body.max_tokens = body.max_output_tokens;
      delete body.max_output_tokens;
    }
  }
  return body;
}

describe("chatCore token field normalization", () => {
  describe("OPENAI_RESPONSES target", () => {
    test("preserves max_output_tokens when already set", () => {
      const result = normalizeTokenFields({ max_output_tokens: 4096 }, OPENAI_RESPONSES);
      assert.equal(result.max_output_tokens, 4096);
      assert.equal(result.max_tokens, undefined);
      assert.equal(result.max_completion_tokens, undefined);
    });

    test("converts max_tokens → max_output_tokens and deletes max_tokens", () => {
      const result = normalizeTokenFields({ max_tokens: 4096 }, OPENAI_RESPONSES);
      assert.equal(result.max_output_tokens, 4096);
      assert.equal(result.max_tokens, undefined);
    });

    test("converts max_completion_tokens → max_output_tokens and deletes max_completion_tokens", () => {
      const result = normalizeTokenFields({ max_completion_tokens: 2048 }, OPENAI_RESPONSES);
      assert.equal(result.max_output_tokens, 2048);
      assert.equal(result.max_completion_tokens, undefined);
    });

    test("max_tokens takes priority over max_completion_tokens when both present", () => {
      // max_tokens swap runs first; max_completion_tokens swap checks max_output_tokens === undefined
      const result = normalizeTokenFields(
        { max_tokens: 1000, max_completion_tokens: 2000 },
        OPENAI_RESPONSES
      );
      assert.equal(result.max_output_tokens, 1000); // max_tokens wins
      assert.equal(result.max_tokens, undefined);
      // max_completion_tokens not swapped because max_output_tokens is now defined
      assert.equal(result.max_completion_tokens, 2000);
    });
  });

  describe("non-Responses target (e.g. openai)", () => {
    test("converts max_output_tokens → max_tokens and deletes original", () => {
      const result = normalizeTokenFields({ max_output_tokens: 4096 }, OPENAI);
      assert.equal(result.max_tokens, 4096);
      assert.equal(
        result.max_output_tokens,
        undefined,
        "must delete max_output_tokens to avoid unknown param upstream"
      );
    });

    test("does not touch max_tokens when already set", () => {
      const result = normalizeTokenFields({ max_tokens: 4096 }, OPENAI);
      assert.equal(result.max_tokens, 4096);
      assert.equal(result.max_output_tokens, undefined);
    });

    test("does not swap when both max_output_tokens and max_tokens are present", () => {
      // Guard: only swap when max_tokens is undefined
      const result = normalizeTokenFields({ max_output_tokens: 2000, max_tokens: 1000 }, OPENAI);
      assert.equal(result.max_tokens, 1000);
      assert.equal(result.max_output_tokens, 2000); // not swapped — max_tokens already set
    });

    test("is a no-op when neither field is present", () => {
      const result = normalizeTokenFields({ model: "gpt-4o" }, OPENAI);
      assert.equal(result.max_tokens, undefined);
      assert.equal(result.max_output_tokens, undefined);
    });
  });
});
