import test from "node:test";
import assert from "node:assert/strict";

const { cleanJSONSchemaForAntigravity } =
  await import("../../open-sse/translator/helpers/geminiHelper.ts");

test("T45: preserve property named pattern in tool input schema", () => {
  const schema = {
    type: "object",
    properties: {
      pattern: { type: "string" },
      path: { type: "string" },
    },
    required: ["pattern"],
  };

  const cleaned = cleanJSONSchemaForAntigravity(schema);
  assert.ok(cleaned.properties.pattern);
  assert.equal(cleaned.properties.pattern.type, "string");
  assert.deepEqual(cleaned.required, ["pattern"]);
});

test("T45: still strip field-level pattern constraint keyword", () => {
  const schema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        pattern: "^[a-z]+$",
      },
    },
    required: ["query"],
  };

  const cleaned = cleanJSONSchemaForAntigravity(schema);
  assert.ok(cleaned.properties.query);
  assert.equal(cleaned.properties.query.type, "string");
  assert.equal(cleaned.properties.query.pattern, undefined);
  assert.deepEqual(cleaned.required, ["query"]);
});
