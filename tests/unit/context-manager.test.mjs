import test from "node:test";
import assert from "node:assert/strict";

const { compressContext, estimateRequestTokens, estimateTokens, getTokenLimit } =
  await import("../../open-sse/services/contextManager.ts");
const { CONTEXT_CONFIG } = await import("../../src/shared/constants/context.ts");

// ─── estimateTokens ─────────────────────────────────────────────────────────

test("estimateTokens: estimates from string", () => {
  assert.equal(estimateTokens("hello"), 2); // 5/4 = 2
  assert.equal(estimateTokens("a".repeat(100)), Math.ceil(100 / 3.5));
});

test("estimateTokens: handles null", () => {
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(""), 0);
});

// ─── getTokenLimit ──────────────────────────────────────────────────────────

test("getTokenLimit: detects claude", () => {
  assert.equal(getTokenLimit("claude", "claude-sonnet-4"), 200000);
});

test("getTokenLimit: detects gemini", () => {
  assert.equal(getTokenLimit("gemini", "gemini-2.5-pro"), 1000000);
});

test("getTokenLimit: default fallback", () => {
  assert.equal(getTokenLimit("unknown"), CONTEXT_CONFIG.defaultLimit);
});

// ─── compressContext ────────────────────────────────────────────────────────

test("compressContext: returns unchanged if fits", () => {
  const body = {
    model: "claude-sonnet-4",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ],
  };
  const result = compressContext(body);
  assert.equal(result.compressed, false);
});

test("compressContext: computes adaptive reserve when reserveTokens is omitted", () => {
  const body = {
    model: "test",
    messages: [{ role: "user", content: "hello" }],
  };

  const result = compressContext(body, { maxTokens: 1000 });
  const expectedTargetTokens = 1000 - 256; // max(256, floor(1000 * 0.15))

  assert.equal(result.compressed, false);
  assert.ok(result.stats.final <= expectedTargetTokens);
});

test("compressContext: adaptive reserve caps at configured global reserve", () => {
  const body = {
    model: "test",
    messages: [{ role: "user", content: "hello" }],
  };

  const result = compressContext(body, { maxTokens: 300000 });
  const expectedTargetTokens = 300000 - CONTEXT_CONFIG.reserveTokens;

  assert.equal(result.compressed, false);
  assert.ok(result.stats.final <= expectedTargetTokens);
});

test("compressContext: clamps explicit reserveTokens to a valid range", () => {
  const body = {
    model: "test",
    messages: [{ role: "user", content: "x".repeat(1500) }],
  };

  const result = compressContext(body, { maxTokens: 1000, reserveTokens: 5000 });

  assert.ok(result.compressed);
  assert.ok(estimateRequestTokens(result.body) <= 1);
});

test("compressContext: handles null/empty body", () => {
  assert.equal(compressContext(null).compressed, false);
  assert.equal(compressContext({}).compressed, false);
  assert.equal(compressContext({ messages: null }).compressed, false);
});

test("compressContext: trims oversized tool messages or purifies them away", () => {
  const longContent = "x".repeat(10000);
  const body = {
    model: "test",
    messages: [
      { role: "user", content: "run tool" },
      { role: "tool", content: longContent, tool_call_id: "t1" },
      { role: "user", content: "done?" },
    ],
  };
  const maxTokens = 500;
  const reserveTokens = 100;
  const targetTokens = maxTokens - reserveTokens;
  const result = compressContext(body, { maxTokens, reserveTokens });

  assert.ok(result.compressed);
  assert.ok(estimateRequestTokens(result.body) <= targetTokens);

  const toolMsg = result.body.messages.find((m) => m.role === "tool");
  if (toolMsg) {
    assert.ok(toolMsg.content.length < longContent.length);
    assert.ok(toolMsg.content.includes("[truncated]"));
  }
});

test("compressContext: Layer 2 — compresses thinking in old messages", () => {
  const body = {
    model: "test",
    messages: [
      { role: "user", content: "q1" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "lots of thinking here ".repeat(500) },
          { type: "text", text: "answer1" },
        ],
      },
      { role: "user", content: "q2" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "more thinking" },
          { type: "text", text: "answer2" },
        ],
      },
    ],
  };
  const result = compressContext(body, { maxTokens: 2000, reserveTokens: 500 });
  // First assistant should have thinking removed
  const firstAssistant = result.body.messages.find((m) => m.role === "assistant");
  if (Array.isArray(firstAssistant.content)) {
    const hasThinking = firstAssistant.content.some((b) => b.type === "thinking");
    assert.equal(hasThinking, false);
  }
});

test("compressContext: Layer 3 — drops old messages to fit", () => {
  const messages = [
    { role: "system", content: "You are helpful" },
    ...Array.from({ length: 100 }, (_, i) => [
      { role: "user", content: `Message ${i}: ${"content ".repeat(50)}` },
      { role: "assistant", content: `Response ${i}: ${"answer ".repeat(50)}` },
    ]).flat(),
  ];
  const body = { model: "test", messages };
  const maxTokens = 3000;
  const reserveTokens = 500;
  const targetTokens = maxTokens - reserveTokens;
  const result = compressContext(body, { maxTokens, reserveTokens });
  assert.ok(result.compressed);
  assert.ok(result.body.messages.length < messages.length);
  // System message preserved
  assert.equal(result.body.messages[0].role, "system");
  assert.ok(
    estimateTokens(JSON.stringify(result.body.messages)) <= targetTokens,
    "Purified history should fit within target token budget"
  );
});

test("compressContext: Layer 3 can drop all non-system messages when needed", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "System" },
      ...Array.from({ length: 8 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: "x".repeat(600),
      })),
    ],
  };

  const result = compressContext(body, { maxTokens: 250, reserveTokens: 200 });

  assert.ok(result.compressed);
  assert.deepEqual(result.body.messages[0], { role: "system", content: "System" });
  assert.ok(
    result.body.messages.length === 1 || result.body.messages.length === 2,
    "Purification may drop all non-system content when budget is extremely tight"
  );
  if (result.body.messages.length === 2) {
    assert.match(result.body.messages[1].content, /Context compressed: 8 earlier messages removed/);
  }
});

test("compressContext: embeds compression summary into first kept user turn", () => {
  const body = {
    model: "test",
    messages: [
      ...Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message-${i} ${"x".repeat(600)}`,
      })),
    ],
  };

  const result = compressContext(body, { maxTokens: 1200, reserveTokens: 0 });
  assert.ok(result.compressed);

  const conversation = result.body.messages.filter(
    (m) => m.role !== "system" && m.role !== "developer"
  );
  assert.ok(conversation.length > 0);
  assert.equal(conversation[0].role, "user");
  assert.ok(
    !(
      conversation.length > 1 &&
      conversation[0].role === "user" &&
      conversation[1].role === "user" &&
      typeof conversation[0].content === "string" &&
      /Context compressed:/.test(conversation[0].content)
    ),
    "Compression summary should be merged into the first kept user turn when possible"
  );
});

test("compressContext: full-body fit check accounts for top-level tools", () => {
  const body = {
    model: "test",
    messages: Array.from({ length: 35 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "x".repeat(300),
    })),
    tools: [
      {
        type: "function",
        function: {
          name: "oversized_tool",
          description: "d".repeat(300),
          parameters: {
            type: "object",
            properties: Object.fromEntries(
              Array.from({ length: 35 }, (_, i) => [
                `field_${i}`,
                { type: "string", description: "p".repeat(100) },
              ])
            ),
          },
        },
      },
    ],
  };

  const maxTokens = 4700;
  const reserveTokens = 200;
  const targetTokens = maxTokens - reserveTokens;
  const result = compressContext(body, { maxTokens, reserveTokens });

  assert.ok(result.compressed);
  assert.ok(
    estimateRequestTokens(result.body) <= targetTokens,
    "Compressed request body should fit even when top-level tools are large"
  );
  assert.ok(
    estimateTokens(JSON.stringify(result.body)) >
      estimateTokens(JSON.stringify(result.body.messages)),
    "Top-level tools should still contribute extra request tokens"
  );
});

test("compressContext: keeps forced tool_choice function after tool compaction", () => {
  const tools = Array.from({ length: 120 }, (_, i) => ({
    type: "function",
    function: {
      name: `tool_${i}`,
      description: `desc ${i}`,
      parameters: { type: "object", properties: { x: { type: "string" } } },
    },
  }));

  const body = {
    model: "test",
    tool_choice: {
      type: "function",
      function: { name: "tool_119" },
    },
    tools,
    messages: [{ role: "user", content: "Run forced tool" }],
  };

  const result = compressContext(body, { maxTokens: 4000, reserveTokens: 200 });
  const compactedTools = Array.isArray(result.body.tools) ? result.body.tools : [];
  const toolNames = compactedTools
    .map((t) => t?.function?.name || t?.name)
    .filter((name) => typeof name === "string");

  assert.ok(result.compressed, "Should trigger compression and compaction");
  assert.ok(compactedTools.length <= 96, "Tool compaction should keep max 96 tools");
  assert.ok(toolNames.includes("tool_119"), "Forced tool_choice function must be preserved");
});

test("compressContext: preserves skills tools during tool compaction", () => {
  const tools = Array.from({ length: 140 }, (_, i) => ({
    type: "function",
    function: {
      name: `tool_${i}`,
      description: `desc ${i}`,
      parameters: { type: "object", properties: { x: { type: "string" } } },
    },
  }));

  tools.push({
    type: "function",
    function: {
      name: "skills_execute",
      description: "Execute registered skills",
      parameters: { type: "object", properties: {} },
    },
  });
  tools.push({
    type: "function",
    function: {
      name: "skills_list",
      description: "List registered skills",
      parameters: { type: "object", properties: {} },
    },
  });

  const body = {
    model: "test",
    tools,
    messages: [{ role: "user", content: "Run a skill" }],
  };

  const result = compressContext(body, { maxTokens: 4000, reserveTokens: 200 });
  const compactedTools = Array.isArray(result.body.tools) ? result.body.tools : [];
  const toolNames = compactedTools
    .map((t) => t?.function?.name || t?.name)
    .filter((name) => typeof name === "string");

  assert.ok(result.compressed, "Should trigger compression and tool compaction");
  assert.ok(compactedTools.length <= 96, "Compacted tool list should respect max tools limit");
  assert.ok(toolNames.includes("skills_execute"), "skills_execute must be preserved");
  assert.ok(toolNames.includes("skills_list"), "skills_list must be preserved");
});

test("compressContext: preserves Claude Code core tools during tool compaction", () => {
  const tools = Array.from({ length: 140 }, (_, i) => ({
    name: `tool_${i}`,
    description: "generic tool " + "x".repeat(120),
    input_schema: { type: "object", properties: { value: { type: "string" } } },
  }));

  tools.push(
    { name: "Read", description: "Read a file", input_schema: { type: "object" } },
    { name: "Update", description: "Update a file", input_schema: { type: "object" } },
    { name: "Edit", description: "Edit a file", input_schema: { type: "object" } },
    { name: "Bash", description: "Run a shell command", input_schema: { type: "object" } }
  );

  const body = {
    model: "claude-sonnet-4.5",
    tools,
    messages: [
      { role: "user", content: "Fix the file" },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "u1", name: "Update", input: {} }],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "u1", content: "File must be read first" }],
      },
    ],
  };

  const result = compressContext(body, { maxTokens: 4500, reserveTokens: 200 });
  const compactedTools = Array.isArray(result.body.tools) ? result.body.tools : [];
  const toolNames = compactedTools.map((tool) => tool.name || tool.function?.name);

  assert.ok(result.compressed, "Should trigger tool compaction");
  assert.ok(
    toolNames.includes("Read"),
    "Read must remain available after Update read-first errors"
  );
  assert.ok(toolNames.includes("Update"), "Recently used Update must remain available");
  assert.ok(toolNames.includes("Edit"), "Edit must remain available for file changes");
  assert.ok(toolNames.includes("Bash"), "Bash must remain available for verification");
});

test("compressContext: purify history keeps user-anchored and tool-coherent conversation", () => {
  const body = {
    model: "claude-sonnet-4.5",
    messages: [
      { role: "user", content: "u0 " + "x".repeat(2500) },
      {
        role: "assistant",
        content: "a0",
        tool_calls: [{ id: "tc1", type: "function", function: { name: "read", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "tc1", content: "r0 " + "y".repeat(2200) },
      { role: "assistant", content: "a1 " + "z".repeat(2200) },
      { role: "user", content: "u1 " + "w".repeat(2200) },
    ],
  };

  const result = compressContext(body, { maxTokens: 1400, reserveTokens: 0 });
  assert.ok(result.compressed, "Expected aggressive purification to trigger");

  const roles = result.body.messages.map((m) => m.role);
  const firstNonSystem = result.body.messages.find(
    (m) => m.role !== "system" && m.role !== "developer"
  );

  assert.equal(
    firstNonSystem?.role,
    "user",
    `Conversation should stay user-anchored, got: ${roles.join(",")}`
  );
  assert.equal(
    roles.includes("tool"),
    false,
    "Orphan tool messages should be dropped after purification"
  );
});

test("compressContext: purify history keeps the preceding user turn for assistant tool chains", () => {
  const body = {
    model: "claude-sonnet-4.5",
    messages: [
      { role: "user", content: "please continue implementation" },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "read_1", name: "read", input: { filePath: "a" } }],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "read_1", content: "file body" }],
      },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "edit_1", name: "edit", input: { filePath: "a" } }],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "edit_1", content: "Edit applied successfully." },
        ],
      },
      {
        role: "assistant",
        content: "I fixed the compression issue and I'm continuing the combo toggle.",
      },
      { role: "user", content: "ok tiep tuc lam di " + "x".repeat(5000) },
    ],
  };

  const result = compressContext(body, { maxTokens: 1400, reserveTokens: 0 });
  assert.ok(result.compressed, "Expected aggressive purification to trigger");

  const conversation = result.body.messages.filter(
    (m) => m.role !== "system" && m.role !== "developer"
  );
  assert.ok(conversation.length > 0);
  assert.equal(
    conversation[0].role,
    "user",
    `Purified history must remain user-anchored, got ${conversation.map((m) => m.role).join(",")}`
  );
});
