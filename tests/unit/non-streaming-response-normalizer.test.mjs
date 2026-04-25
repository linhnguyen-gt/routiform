import test from "node:test";
import assert from "node:assert/strict";

import { normalizeNonStreamingTranslatedResponse } from "../../open-sse/handlers/utils/non-streaming-response-normalizer.ts";

test("normalizeNonStreamingTranslatedResponse collapses exact duplicated message content", () => {
  const normalized = normalizeNonStreamingTranslatedResponse({
    requestBody: { messages: [{ role: "user", content: "go" }] },
    responseBody: {
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Đang làm ngay.Đang làm ngay." },
          finish_reason: "stop",
        },
      ],
    },
    sourceFormat: "openai",
    targetFormat: "openai",
    stream: false,
    toolNameMap: null,
  });

  assert.equal(normalized.choices[0].message.content, "Đang làm ngay.");
});

test("normalizeNonStreamingTranslatedResponse keeps normal content unchanged", () => {
  const normalized = normalizeNonStreamingTranslatedResponse({
    requestBody: { messages: [{ role: "user", content: "go" }] },
    responseBody: {
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Đang làm ngay." },
          finish_reason: "stop",
        },
      ],
    },
    sourceFormat: "openai",
    targetFormat: "openai",
    stream: false,
    toolNameMap: null,
  });

  assert.equal(normalized.choices[0].message.content, "Đang làm ngay.");
});

test("normalizeNonStreamingTranslatedResponse collapses duplicated short message with newline seam", () => {
  const normalized = normalizeNonStreamingTranslatedResponse({
    requestBody: { messages: [{ role: "user", content: "go" }] },
    responseBody: {
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Chưa done.\nChưa done." },
          finish_reason: "stop",
        },
      ],
    },
    sourceFormat: "openai",
    targetFormat: "openai",
    stream: false,
    toolNameMap: null,
  });

  assert.equal(normalized.choices[0].message.content, "Chưa done.");
});

test("normalizeNonStreamingTranslatedResponse collapses duplicate Claude text blocks", () => {
  const normalized = normalizeNonStreamingTranslatedResponse({
    requestBody: { messages: [{ role: "user", content: "go" }] },
    responseBody: {
      id: "chatcmpl_test",
      object: "chat.completion",
      model: "gpt-5.3-codex",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Đang làm ngay.Đang làm ngay." },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    },
    sourceFormat: "claude",
    targetFormat: "openai",
    stream: false,
    toolNameMap: null,
  });

  assert.equal(normalized.type, "message");
  assert.equal(normalized.content[0].type, "text");
  assert.equal(normalized.content[0].text, "Đang làm ngay.");
});

test("normalizeNonStreamingTranslatedResponse marks execution-claim text when no tool calls were emitted", () => {
  const normalized = normalizeNonStreamingTranslatedResponse({
    requestBody: {
      messages: [{ role: "user", content: "do it" }],
      tools: [{ type: "function", function: { name: "read", parameters: { type: "object" } } }],
    },
    responseBody: {
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Đang làm ngay." },
          finish_reason: "stop",
        },
      ],
    },
    sourceFormat: "openai",
    targetFormat: "openai",
    stream: false,
    toolNameMap: null,
  });

  assert.match(
    normalized.choices[0].message.content,
    /No tool calls were emitted by the model, so no tool was executed\./
  );
});

test("normalizeNonStreamingTranslatedResponse does not mark when tool_calls exist", () => {
  const normalized = normalizeNonStreamingTranslatedResponse({
    requestBody: {
      messages: [{ role: "user", content: "do it" }],
      tools: [{ type: "function", function: { name: "read", parameters: { type: "object" } } }],
    },
    responseBody: {
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Đang làm ngay.",
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: { name: "read", arguments: "{}" },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    },
    sourceFormat: "openai",
    targetFormat: "openai",
    stream: false,
    toolNameMap: null,
  });

  assert.equal(
    normalized.choices[0].message.content,
    "Đang làm ngay.",
    "warning should not be injected when tool_calls are present"
  );
});
