import test from "node:test";
import assert from "node:assert/strict";

const { rehydrateToolResultTextBlocks } =
  await import("../../open-sse/translator/helpers/claudeHelper.ts");
const { prepareClaudeRequest } = await import("../../open-sse/translator/helpers/claudeHelper.ts");

test("converts [Tool Result: id] text to tool_result when tool_use exists", () => {
  const messages = [
    { role: "assistant", content: [{ type: "tool_use", id: "call_abc", name: "Read", input: {} }] },
    {
      role: "user",
      content: [{ type: "text", text: "[Tool Result: call_abc]\nfile content here" }],
    },
  ];
  rehydrateToolResultTextBlocks(messages);
  assert.deepEqual(messages[1].content[0], {
    type: "tool_result",
    tool_use_id: "call_abc",
    content: "file content here",
  });
});

test("keeps text block when no matching tool_use exists", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "[Tool Result: call_orphan]\ndata" }] },
  ];
  rehydrateToolResultTextBlocks(messages);
  assert.equal(messages[0].content[0].type, "text");
});

test("does not affect non-tool-result text blocks", () => {
  const messages = [{ role: "user", content: [{ type: "text", text: "Just a normal message" }] }];
  rehydrateToolResultTextBlocks(messages);
  assert.equal(messages[0].content[0].type, "text");
  assert.equal(messages[0].content[0].text, "Just a normal message");
});

test("handles functions_Read_48 style IDs", () => {
  const messages = [
    {
      role: "assistant",
      content: [{ type: "tool_use", id: "functions_Read_48", name: "Read", input: {} }],
    },
    {
      role: "user",
      content: [{ type: "text", text: "[Tool Result: functions_Read_48]\nresult" }],
    },
  ];
  rehydrateToolResultTextBlocks(messages);
  assert.equal(messages[1].content[0].tool_use_id, "functions_Read_48");
  assert.equal(messages[1].content[0].type, "tool_result");
});

test("handles tool_result text block with no newline after header", () => {
  const messages = [
    { role: "assistant", content: [{ type: "tool_use", id: "call_x", name: "Bash", input: {} }] },
    { role: "user", content: [{ type: "text", text: "[Tool Result: call_x]\n" }] },
  ];
  rehydrateToolResultTextBlocks(messages);
  assert.equal(messages[1].content[0].type, "tool_result");
  assert.equal(messages[1].content[0].content, "");
});

test("does not mutate non-text blocks in user message", () => {
  const imageBlock = { type: "image", source: { type: "base64", data: "abc" } };
  const messages = [
    { role: "assistant", content: [{ type: "tool_use", id: "call_1", name: "x", input: {} }] },
    { role: "user", content: [imageBlock, { type: "text", text: "[Tool Result: call_1]\nok" }] },
  ];
  rehydrateToolResultTextBlocks(messages);
  assert.equal(messages[1].content[0].type, "image");
  assert.equal(messages[1].content[1].type, "tool_result");
});

test("prepareClaudeRequest end-to-end: orphan tool_use triggers rehydration", () => {
  const body = {
    messages: [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "call_xyz", name: "Bash", input: {} }],
      },
      {
        role: "user",
        content: [{ type: "text", text: "[Tool Result: call_xyz]\noutput" }],
      },
    ],
  };
  prepareClaudeRequest(body, "claude");
  const userMsg = body.messages.find((m) => m.role === "user");
  assert.ok(userMsg, "user message must exist");
  const toolResultBlock = userMsg.content.find((b) => b.type === "tool_result");
  assert.ok(toolResultBlock, "user message must contain tool_result block");
  assert.equal(toolResultBlock.tool_use_id, "call_xyz");
  assert.equal(toolResultBlock.content, "output");
});
