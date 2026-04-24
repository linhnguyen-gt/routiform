import test from "node:test";
import assert from "node:assert/strict";

const { buildKiroPayload } = await import("../../open-sse/translator/request/openai-to-kiro.ts");

test("Kiro tool inputSchema strips $schema and propertyNames (Bedrock wire compliance)", () => {
  const payload = buildKiroPayload(
    "kiro/claude-sonnet-4.5",
    {
      messages: [{ role: "user", content: "hi" }],
      tools: [
        {
          type: "function",
          function: {
            name: "demo_tool",
            description: "d",
            parameters: {
              $schema: "https://json-schema.org/draft/2020-12/schema",
              type: "object",
              properties: {
                answers: {
                  type: "object",
                  propertyNames: { type: "string", maxLength: 10 },
                  additionalProperties: { type: "string" },
                },
              },
              required: [],
            },
          },
        },
      ],
    },
    true,
    undefined
  );

  const tools =
    payload.conversationState.currentMessage.userInputMessage.userInputMessageContext?.tools;
  assert.ok(Array.isArray(tools) && tools.length === 1);
  const json = tools[0].toolSpecification.inputSchema.json;
  const s = JSON.stringify(json);
  assert.equal(s.includes("$schema"), false);
  assert.equal(s.includes("propertyNames"), false);
  assert.equal(json.type, "object");
  assert.ok(json.properties && typeof json.properties.answers === "object");
});
