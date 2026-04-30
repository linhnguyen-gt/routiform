import test from "node:test";
import assert from "node:assert/strict";

const { normalizeOpenAiStyleMessagesForTranslation } =
  await import("../../open-sse/handlers/chat-core/chat-core-normalize-openai-messages.ts");

test("strips unsupported-image error block from history when switching to vision model", () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "check [Image 1]  hiện tại hiển thị trong app quá xấu" },
          {
            type: "text",
            text: 'ERROR: Cannot read "Screenshot 2026-04-29 at 23.56.05.png" (this model does not support image input). Inform the user.',
          },
        ],
      },
    ],
  };

  normalizeOpenAiStyleMessagesForTranslation(body, "openai-responses", null);

  const content = body.messages[0].content;
  assert.equal(content.length, 1, "error block should be stripped");
  assert.equal(content[0].text, "check [Image 1]  hiện tại hiển thị trong app quá xấu");
});

test("strips error block with single-quoted filename", () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "analyze this" },
          {
            type: "text",
            text: "ERROR: Cannot read 'photo.png' (this model does not support image input). Inform the user.",
          },
        ],
      },
    ],
  };

  normalizeOpenAiStyleMessagesForTranslation(body, "openai", null);

  const content = body.messages[0].content;
  assert.equal(content.length, 1);
  assert.equal(content[0].text, "analyze this");
});

test("strips error block with no quotes around filename", () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "look at this" },
          {
            type: "text",
            text: "ERROR: Cannot read image.jpg (this model does not support image input). Inform the user.",
          },
        ],
      },
    ],
  };

  normalizeOpenAiStyleMessagesForTranslation(body, "openai", null);

  const content = body.messages[0].content;
  assert.equal(content.length, 1);
  assert.equal(content[0].text, "look at this");
});

test("keeps normal text blocks untouched", () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "hello" },
          { type: "text", text: "world" },
        ],
      },
    ],
  };

  normalizeOpenAiStyleMessagesForTranslation(body, "openai", null);

  assert.equal(body.messages[0].content.length, 2);
});

test("keeps image_url blocks untouched", () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "analyze" },
          { type: "image_url", image_url: { url: "https://example.com/img.png" } },
        ],
      },
    ],
  };

  normalizeOpenAiStyleMessagesForTranslation(body, "openai", null);

  assert.equal(body.messages[0].content.length, 2);
  assert.equal(body.messages[0].content[1].type, "image_url");
});

test("multiple messages - only strips error blocks", () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "check image" },
          {
            type: "text",
            text: 'ERROR: Cannot read "file.png" (this model does not support image input). Inform the user.',
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "I cannot process images" }],
      },
      {
        role: "user",
        content: [{ type: "text", text: "ok try again" }],
      },
    ],
  };

  normalizeOpenAiStyleMessagesForTranslation(body, "openai-responses", null);

  assert.equal(body.messages[0].content.length, 1, "error stripped from first message");
  assert.equal(body.messages[1].content.length, 1, "assistant message untouched");
  assert.equal(body.messages[2].content.length, 1, "last user message untouched");
});
