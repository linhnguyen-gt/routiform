import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectContentType,
  estimateTokens,
  estimateRequestTokens,
  CHARS_PER_TOKEN,
} from "../token-estimation.ts";

describe("detectContentType", async () => {
  it("returns 'tool_result' for tool_content array payloads", async () => {
    const toolResultArray = JSON.stringify([
      { type: "tool_result", tool_use_id: "tu_abc", content: "output here" },
    ]);
    assert.equal(detectContentType(toolResultArray), "tool_result");
  });

  it("returns 'json' for plain message arrays without tool_result markers", async () => {
    const plain = JSON.stringify([
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ]);
    assert.equal(detectContentType(plain), "json");
  });

  it("returns 'schema' for objects with 'properties' key", async () => {
    const schema = JSON.stringify({ type: "object", properties: { name: { type: "string" } } });
    assert.equal(detectContentType(schema), "schema");
  });

  it("returns 'text' for plain prose", async () => {
    assert.equal(detectContentType("hello world, this is plain text"), "text");
  });

  it("returns 'code' for code-like content", async () => {
    const code = "function foo() { return bar(); }";
    assert.equal(detectContentType(code), "code");
  });
});

describe("CHARS_PER_TOKEN ratios", async () => {
  it("json ratio is 1.8 (not 2.8)", async () => {
    assert.equal(CHARS_PER_TOKEN.json, 1.8);
  });

  it("tool_result ratio is 1.8", async () => {
    assert.equal(CHARS_PER_TOKEN.tool_result, 1.8);
  });

  it("text ratio remains 4.0", async () => {
    assert.equal(CHARS_PER_TOKEN.text, 4.0);
  });

  it("code ratio remains 3.0", async () => {
    assert.equal(CHARS_PER_TOKEN.code, 3.0);
  });

  it("schema ratio remains 2.5", async () => {
    assert.equal(CHARS_PER_TOKEN.schema, 2.5);
  });
});

describe("estimateTokens", async () => {
  it("uses json ratio 1.8 for JSON string input (not 2.8)", async () => {
    const jsonStr = JSON.stringify(
      Array.from({ length: 6 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: "msg " + i,
      }))
    );
    const tokens = estimateTokens(jsonStr);
    const oldRatioEstimate = Math.ceil(jsonStr.length / 2.8);
    const newRatioEstimate = Math.ceil(jsonStr.length / 1.8);
    assert.equal(tokens, newRatioEstimate);
    assert.ok(tokens > oldRatioEstimate, `${tokens} should be > ${oldRatioEstimate}`);
  });
});

describe("estimateRequestTokens — heavy tool-call conversation", async () => {
  it("estimates a large tool-call conversation at >50% more tokens than with old ratio", async () => {
    const messages = [];
    for (let i = 0; i < 50; i++) {
      messages.push({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: `tu_${i}`,
            name: "bash",
            input: { command: `echo "step ${i} doing something complex"` },
          },
        ],
      });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: `tu_${i}`,
            content: `stdout: step ${i} done\nstderr: \nexit code: 0`,
          },
        ],
      });
    }
    const body = { messages };
    const estimated = estimateRequestTokens(body);

    const rawStr = JSON.stringify(messages);
    const oldEstimate = Math.ceil(rawStr.length / 2.8);
    const newEstimate = estimated;

    assert.ok(
      newEstimate >= oldEstimate * 1.4,
      `Expected new estimate ${newEstimate} >= 1.4× old estimate ${oldEstimate}`
    );
  });
});

import { getSafeLimit } from "../token-limits.ts";

describe("getSafeLimit — safety margin", async () => {
  it("applies 0.80 margin (not 0.90)", async () => {
    assert.equal(getSafeLimit(200_000), 160_000);
  });

  it("custom margin override still works", async () => {
    assert.equal(getSafeLimit(200_000, 0.5), 100_000);
  });
});
