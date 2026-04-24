import test from "node:test";
import assert from "node:assert/strict";

const { filterToOpenAIFormat } = await import("../../open-sse/translator/helpers/openaiHelper.ts");

test("DeepSeek: assistant message with reasoning_content + empty content NOT filtered", () => {
  const body = {
    messages: [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        reasoning_content: "Let me think about this...",
        content: "",
      },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1].role, "assistant");
  assert.equal(result.messages[1].reasoning_content, "Let me think about this...");
});

test("DeepSeek: assistant message with reasoning_content + empty array content NOT filtered", () => {
  const body = {
    messages: [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        reasoning_content: "Analyzing the request...",
        content: [{ type: "text", text: "" }],
      },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1].role, "assistant");
  assert.equal(result.messages[1].reasoning_content, "Analyzing the request...");
});

test("DeepSeek: existing reasoning_content from history preserved in next request", () => {
  const body = {
    messages: [
      { role: "user", content: "What is 2+2?" },
      {
        role: "assistant",
        reasoning_content: "Let me calculate: 2+2=4",
        content: "The answer is 4",
      },
      { role: "user", content: "What about 3+3?" },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages.length, 3);
  assert.equal(result.messages[1].reasoning_content, "Let me calculate: 2+2=4");
  assert.equal(result.messages[1].content, "The answer is 4");
});

test("DeepSeek: 'reasoning' alias normalized to reasoning_content", () => {
  const body = {
    messages: [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        reasoning: "This is the reasoning field",
        content: "response",
      },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages[1].reasoning_content, "This is the reasoning field");
  assert.equal(result.messages[1].reasoning, undefined);
});

test("DeepSeek: existing reasoning_content takes priority over extracted thinking", () => {
  const body = {
    messages: [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        reasoning_content: "Existing reasoning from history",
        content: [
          { type: "thinking", thinking: "New thinking block" },
          { type: "text", text: "response" },
        ],
      },
    ],
  };

  const result = filterToOpenAIFormat(body);

  // Existing reasoning_content should be preserved, not overwritten by thinking block
  assert.equal(result.messages[1].reasoning_content, "Existing reasoning from history");
});

test("DeepSeek: thinking block extracted as reasoning_content when no existing reasoning", () => {
  const body = {
    messages: [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me analyze this..." },
          { type: "text", text: "Here's my response" },
        ],
      },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages[1].reasoning_content, "Let me analyze this...");
  assert.equal(result.messages[1].content.length, 1);
  assert.equal(result.messages[1].content[0].type, "text");
});

test("DeepSeek: multi-turn conversation preserves reasoning_content throughout", () => {
  const body = {
    messages: [
      { role: "user", content: "First question" },
      {
        role: "assistant",
        reasoning_content: "First reasoning",
        content: "First answer",
      },
      { role: "user", content: "Second question" },
      {
        role: "assistant",
        reasoning_content: "Second reasoning",
        content: "Second answer",
      },
      { role: "user", content: "Third question" },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages.length, 5);
  assert.equal(result.messages[1].reasoning_content, "First reasoning");
  assert.equal(result.messages[3].reasoning_content, "Second reasoning");
});

test("Regression: Anthropic messages without reasoning_content work normally", () => {
  const body = {
    messages: [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [{ type: "text", text: "response" }],
      },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1].reasoning_content, undefined);
  assert.equal(result.messages[1].content[0].text, "response");
});

test("Regression: OpenAI messages without reasoning_content work normally", () => {
  const body = {
    messages: [
      { role: "user", content: "hello" },
      { role: "assistant", content: "response" },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1].reasoning_content, undefined);
  assert.equal(result.messages[1].content, "response");
});

test("Regression: Gemini messages without reasoning_content work normally", () => {
  const body = {
    messages: [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [{ type: "text", text: "Gemini response" }],
      },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1].reasoning_content, undefined);
});

test("DeepSeek: no-thinking payload unchanged (empty reasoning_content not added)", () => {
  const body = {
    messages: [
      { role: "user", content: "hello" },
      { role: "assistant", content: "simple response" },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1].reasoning_content, undefined);
  assert.equal(result.messages[1].content, "simple response");
});

test("DeepSeek: tool_calls message with reasoning_content preserved", () => {
  const body = {
    messages: [
      { role: "user", content: "What's the weather?" },
      {
        role: "assistant",
        reasoning_content: "User wants weather data",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "get_weather", arguments: "{}" },
          },
        ],
      },
    ],
  };

  const result = filterToOpenAIFormat(body);

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1].reasoning_content, "User wants weather data");
  assert.ok(result.messages[1].tool_calls);
});
