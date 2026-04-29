import test from "node:test";
import assert from "node:assert/strict";

const { cleanJSONSchemaForAntigravity } =
  await import("../../open-sse/translator/helpers/geminiHelper.ts");

test("T16: enum-only fields gain type:string after Gemini schema cleanup", () => {
  const schema = {
    type: "object",
    properties: {
      mode: {
        enum: ["fast", "balanced", "slow"],
      },
    },
    required: ["mode"],
  };

  const cleaned = cleanJSONSchemaForAntigravity(schema);
  assert.equal(cleaned.properties.mode.type, "string");
  assert.deepEqual(cleaned.properties.mode.enum, ["fast", "balanced", "slow"]);
});

test("T16: existing explicit type:string is preserved", () => {
  const schema = {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["auto", "manual"],
      },
    },
  };

  const cleaned = cleanJSONSchemaForAntigravity(schema);
  assert.equal(cleaned.properties.mode.type, "string");
  assert.deepEqual(cleaned.properties.mode.enum, ["auto", "manual"]);
});

test("T16: tuple-style items array strips null entries", () => {
  const schema = {
    type: "object",
    properties: {
      pair: {
        type: "array",
        items: [{ type: "string" }, null, { type: "number" }],
      },
    },
  };

  const cleaned = cleanJSONSchemaForAntigravity(schema);
  assert.deepEqual(cleaned.properties.pair.items, [{ type: "string" }, { type: "number" }]);
});

test("T16: invalid required keys not in properties are stripped", () => {
  const schema = {
    type: "object",
    properties: {
      only: { type: "string" },
    },
    required: ["only", "missing_field", "another_ghost"],
  };

  const cleaned = cleanJSONSchemaForAntigravity(schema);
  assert.deepEqual(cleaned.required, ["only"]);
});

test("T16: null entries are removed from enum arrays before string coercion", () => {
  const schema = {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["a", null, "b"],
      },
    },
  };

  const cleaned = cleanJSONSchemaForAntigravity(schema);
  assert.deepEqual(cleaned.properties.mode.enum, ["a", "b"]);
});

test("T16: schemas without enum are not forced to string", () => {
  const schema = {
    type: "object",
    properties: {
      retries: {
        type: "number",
        minimum: 0,
      },
    },
  };

  const cleaned = cleanJSONSchemaForAntigravity(schema);
  assert.equal(cleaned.properties.retries.type, "number");
  assert.equal(cleaned.properties.retries.enum, undefined);
});
