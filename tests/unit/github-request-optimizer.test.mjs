import test from "node:test";
import assert from "node:assert/strict";

test("optimizeGithubRequestBody caps Haiku tokens to 4096 when tools are present", async () => {
  const { optimizeGithubRequestBody } =
    await import("../../open-sse/utils/githubRequestOptimizer.ts");

  const body = {
    model: "github/claude-haiku-4.5",
    max_tokens: 32000,
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string", description: "City name" },
            },
          },
        },
      },
    ],
  };

  const result = optimizeGithubRequestBody(body, String(body.model));

  assert.equal(body.max_tokens, 4096);
  assert.ok(result.actions.includes("cap_max_tokens_4096"));
});

test("optimizeGithubRequestBody strips schema descriptions but keeps parameter named description", async () => {
  const { optimizeGithubRequestBody } =
    await import("../../open-sse/utils/githubRequestOptimizer.ts");

  const body = {
    tools: [
      {
        type: "function",
        function: {
          name: "save_note",
          description: "Save note",
          parameters: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "This is field metadata",
              },
            },
          },
        },
      },
    ],
  };

  optimizeGithubRequestBody(body, "claude-sonnet-4.5");

  assert.equal(body.tools[0].function.description, undefined);
  assert.equal(body.tools[0].function.parameters.properties.description.type, "string");
  assert.equal(body.tools[0].function.parameters.properties.description.description, undefined);
});

test("optimizeGithubRequestBody truncates tools and preserves required tool choice", async () => {
  const { optimizeGithubRequestBody } =
    await import("../../open-sse/utils/githubRequestOptimizer.ts");

  const tools = Array.from({ length: 140 }, (_, i) => ({
    type: "function",
    function: {
      name: `tool_${i}`,
      description: `Tool ${i}`,
      parameters: { type: "object", properties: {} },
    },
  }));

  const body = {
    tools,
    tool_choice: {
      type: "function",
      function: { name: "tool_139" },
    },
  };

  const result = optimizeGithubRequestBody(body, "claude-sonnet-4.5");

  assert.equal(Array.isArray(body.tools), true);
  assert.equal(body.tools.length, 128);
  assert.ok(body.tools.some((t) => t.function.name === "tool_139"));
  assert.ok(result.actions.includes("truncate_tools_128"));
});
