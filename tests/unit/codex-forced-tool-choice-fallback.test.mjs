import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyForcedToolChoiceFallback } from "../../open-sse/handlers/responseTranslator.ts";

describe("applyForcedToolChoiceFallback", () => {
  it("should synthesize tool_calls when tool_choice is forced and content is valid JSON", () => {
    const requestBody = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Read /tmp/a" }],
      tools: [
        {
          type: "function",
          function: {
            name: "read_file",
            description: "Read a file",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string" },
              },
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "read_file" },
      },
    };

    const responseBody = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: '{"path":"/tmp/a"}',
          },
          finish_reason: "stop",
        },
      ],
    };

    const result = applyForcedToolChoiceFallback(requestBody, responseBody);

    assert.equal(result.choices[0].finish_reason, "tool_calls");
    assert.equal(result.choices[0].message.content, "");
    assert.equal(Array.isArray(result.choices[0].message.tool_calls), true);
    assert.equal(result.choices[0].message.tool_calls.length, 1);
    assert.equal(result.choices[0].message.tool_calls[0].type, "function");
    assert.equal(result.choices[0].message.tool_calls[0].function.name, "read_file");
    assert.equal(result.choices[0].message.tool_calls[0].function.arguments, '{"path":"/tmp/a"}');
    assert.ok(result.choices[0].message.tool_calls[0].id);
  });

  it("should not modify response when tool_calls already exist", () => {
    const requestBody = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Read /tmp/a" }],
      tools: [
        {
          type: "function",
          function: {
            name: "read_file",
            description: "Read a file",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string" },
              },
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "read_file" },
      },
    };

    const responseBody = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "call_abc123",
                type: "function",
                function: {
                  name: "read_file",
                  arguments: '{"path":"/tmp/a"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };

    const result = applyForcedToolChoiceFallback(requestBody, responseBody);

    // Should return unchanged
    assert.deepEqual(result, responseBody);
  });

  it("should not modify response when content is not valid JSON", () => {
    const requestBody = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Read /tmp/a" }],
      tools: [
        {
          type: "function",
          function: {
            name: "read_file",
            description: "Read a file",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string" },
              },
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "read_file" },
      },
    };

    const responseBody = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "I cannot help with that",
          },
          finish_reason: "stop",
        },
      ],
    };

    const result = applyForcedToolChoiceFallback(requestBody, responseBody);

    // Should return unchanged
    assert.deepEqual(result, responseBody);
  });

  it("should not modify response when tool_choice is auto (not forced)", () => {
    const requestBody = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Read /tmp/a" }],
      tools: [
        {
          type: "function",
          function: {
            name: "read_file",
            description: "Read a file",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string" },
              },
            },
          },
        },
      ],
      tool_choice: "auto",
    };

    const responseBody = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: '{"path":"/tmp/a"}',
          },
          finish_reason: "stop",
        },
      ],
    };

    const result = applyForcedToolChoiceFallback(requestBody, responseBody);

    // Should return unchanged
    assert.deepEqual(result, responseBody);
  });

  it("should handle tool_choice: required by using first tool name", () => {
    const requestBody = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Read /tmp/a" }],
      tools: [
        {
          type: "function",
          function: {
            name: "read_file",
            description: "Read a file",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "write_file",
            description: "Write a file",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string" },
                content: { type: "string" },
              },
            },
          },
        },
      ],
      tool_choice: "required",
    };

    const responseBody = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: '{"path":"/tmp/a"}',
          },
          finish_reason: "stop",
        },
      ],
    };

    const result = applyForcedToolChoiceFallback(requestBody, responseBody);

    assert.equal(result.choices[0].finish_reason, "tool_calls");
    assert.equal(result.choices[0].message.content, "");
    assert.equal(result.choices[0].message.tool_calls[0].function.name, "read_file");
    assert.equal(result.choices[0].message.tool_calls[0].function.arguments, '{"path":"/tmp/a"}');
  });

  it("should not modify when tool_choice=required but tools array is empty", () => {
    const requestBody = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Read /tmp/a" }],
      tools: [],
      tool_choice: "required",
    };

    const responseBody = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: '{"path":"/tmp/a"}',
          },
          finish_reason: "stop",
        },
      ],
    };

    const result = applyForcedToolChoiceFallback(requestBody, responseBody);

    // Should return unchanged since no tools available
    assert.deepEqual(result, responseBody);
  });
});
