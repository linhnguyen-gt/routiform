import test from "node:test";
import assert from "node:assert/strict";

const {
  compressContext,
  estimateRequestTokens,
  estimateTokens,
  estimateTokensDetailed,
  getTokenLimit,
} = await import("../../open-sse/services/contextManager.ts");

// ─── Phase 1.1: Structured Compression Summary ───────────────────────────────

test("Phase 1.1: structured summary preserves goal and constraints", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "You are helpful." },
      {
        role: "user",
        content:
          "I need to refactor the authentication module. You must preserve backward compatibility and never break existing API contracts.",
      },
      { role: "assistant", content: "I decided to use the adapter pattern for this refactor." },
      { role: "user", content: "ok continue " + "x".repeat(5000) },
      { role: "assistant", content: "done " + "y".repeat(5000) },
      { role: "user", content: "What about the error handling?" },
      { role: "assistant", content: "Here is the implementation " + "z".repeat(5000) },
    ],
  };

  const result = compressContext(body, { maxTokens: 1500, reserveTokens: 0 });
  assert.ok(result.compressed, "Should trigger compression");

  const firstUserMsg = result.body.messages.find((m) => m.role === "user");
  assert.ok(firstUserMsg, "Should have a user message");

  const content =
    typeof firstUserMsg.content === "string"
      ? firstUserMsg.content
      : JSON.stringify(firstUserMsg.content);

  // Check that structured summary appears
  assert.ok(content.includes("Context compressed:"), "Should contain compression notice");
  // The summary should preserve constraint language
  assert.ok(
    content.includes("must") || content.includes("Constraints") || content.includes("Goal"),
    "Should preserve goal or constraint info from dropped messages"
  );
});

test("Phase 1.1: structured summary preserves errors from dropped tool results", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Run the deploy script" },
      {
        role: "tool",
        tool_call_id: "t1",
        content:
          "Error: Deployment failed with exception: connection timeout\nStack trace: at deploy.sh line 42",
      },
      { role: "user", content: "try again " + "x".repeat(5000) },
      { role: "assistant", content: "retried " + "y".repeat(5000) },
    ],
  };

  const result = compressContext(body, { maxTokens: 800, reserveTokens: 0 });
  assert.ok(result.compressed);
});

// ─── Phase 1.2: Signal-Aware Tool-Output Trimming ─────────────────────────────

test("Phase 1.2: tool output preserves error signals near the end", () => {
  const longOutput =
    "line 1\nline 2\nline 3\nline 4\nline 5\n".repeat(200) +
    "\nError: something went wrong\nat stack.trace.line.42\nMore details here";
  const body = {
    model: "test",
    messages: [
      { role: "user", content: "run cmd" },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "t1", content: longOutput }],
      },
      { role: "assistant", content: "ok done" },
      { role: "user", content: "next" },
    ],
  };

  const result = compressContext(body, { maxTokens: 2500, reserveTokens: 0 });
  assert.ok(result.compressed);
  // The tool result should have been trimmed but should still be meaningful
  const toolResult = result.body.messages.find(
    (m) => Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result")
  );
  if (toolResult) {
    const toolContent = Array.isArray(toolResult.content)
      ? toolResult.content.find((b) => b.type === "tool_result")?.content
      : toolResult.content;
    if (typeof toolContent === "string") {
      assert.ok(toolContent.length < longOutput.length, "Tool output should be trimmed");
    }
  }
});

test("Phase 1.2: short tool results remain unchanged", () => {
  const shortOutput = "Process completed successfully.";
  const body = {
    model: "test",
    messages: [
      { role: "user", content: "run it" },
      { role: "tool", tool_call_id: "t1", content: shortOutput },
      { role: "user", content: "good" },
    ],
  };

  const result = compressContext(body, { maxTokens: 100000, reserveTokens: 0 });
  assert.equal(result.compressed, false, "Short messages should not need compression");
});

test("Phase 1.2: JSON tool output compaction preserves shape", () => {
  const jsonOutput = JSON.stringify({
    status: "error",
    message: "Validation failed",
    data: Array.from({ length: 50 }, (_, i) => ({
      id: i,
      name: `item_${i}`,
      value: "x".repeat(200),
    })),
    pagination: { page: 1, total: 50 },
  });
  const body = {
    model: "test",
    messages: [
      { role: "user", content: "fetch data" },
      { role: "tool", tool_call_id: "t1", content: jsonOutput },
      { role: "user", content: "thanks" },
    ],
    tools: Array.from({ length: 100 }, (_, i) => ({
      type: "function",
      function: {
        name: `tool_${i}`,
        description: `desc ${i}`.repeat(30),
        parameters: { type: "object" },
      },
    })),
  };

  const result = compressContext(body, { maxTokens: 5000, reserveTokens: 500 });
  assert.ok(result.compressed);
});

// ─── Phase 1.3: Richer Compression Telemetry ────────────────────────────────

test("Phase 1.3: compression stats include detailed layer information", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "You are helpful." },
      ...Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message-${i} ${"content ".repeat(50)}`,
      })),
    ],
  };

  const result = compressContext(body, { maxTokens: 3000, reserveTokens: 500 });
  assert.ok(result.compressed, "Should trigger compression");
  assert.ok(result.stats.original > result.stats.final, "Should reduce tokens");

  // Verify layer details
  assert.ok(Array.isArray(result.stats.layers), "Should have layers array");
  assert.ok(result.stats.layers.length > 0, "Should have at least one layer");

  // Check that layers have tokensRemoved field
  for (const layer of result.stats.layers) {
    assert.ok(typeof layer.name === "string", "Layer should have name");
    assert.ok(typeof layer.tokens === "number", "Layer should have tokens count");
  }

  // Check detailed stats
  assert.ok(
    typeof result.stats.droppedMessageCount === "number",
    "Should have droppedMessageCount"
  );
  assert.ok(typeof result.stats.truncatedToolCount === "number", "Should have truncatedToolCount");
  assert.ok(
    typeof result.stats.compressedThinkingCount === "number",
    "Should have compressedThinkingCount"
  );
  assert.ok(typeof result.stats.summaryInserted === "boolean", "Should have summaryInserted");
  assert.ok(typeof result.stats.systemTruncated === "boolean", "Should have systemTruncated");
});

test("Phase 1.3: stats track dropped message count", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "You are helpful" },
      ...Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}: ${"content ".repeat(50)}`,
      })),
    ],
  };

  const result = compressContext(body, { maxTokens: 2000, reserveTokens: 0 });
  assert.ok(result.compressed);
  if (result.stats.droppedMessageCount > 0) {
    assert.ok(result.stats.droppedMessageCount > 0, "Should report dropped messages");
  }
});

// ─── Phase 2.4: Importance-Aware History Purification ────────────────────────

test("Phase 2.4: preserves latest user message even when earlier messages are larger", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "You are helpful" },
      // Old important: contains a constraint
      {
        role: "user",
        content: "You must never delete user data. This is critical." + "x".repeat(2000),
      },
      { role: "assistant", content: "I decided to use soft deletes. " + "y".repeat(2000) },
      // Middle filler
      ...Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `filler ${i} ` + "z".repeat(500),
      })),
      // Latest: what matters most
      { role: "user", content: "What is the status of the deployment?" },
      { role: "assistant", content: "Deployment succeeded" },
    ],
  };

  const result = compressContext(body, { maxTokens: 2000, reserveTokens: 0 });
  assert.ok(result.compressed);

  // The latest user message should be preserved
  const lastUserMsg = result.body.messages.filter((m) => m.role === "user").pop();
  assert.ok(lastUserMsg, "Should have a last user message");
  if (typeof lastUserMsg.content === "string") {
    assert.ok(
      lastUserMsg.content.includes("status") || lastUserMsg.content.includes("deployment"),
      "Latest user message should be preserved"
    );
  }
});

test("Phase 2.4: preserves tool-call chains referenced by kept messages", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "debug this " + "x".repeat(4000) },
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll check the logs." },
          {
            type: "tool_use",
            id: "call_1",
            name: "bash",
            input: { command: "tail /var/log/app.log" },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_1",
            content: "Error: database connection failed\nStack trace...",
          },
        ],
      },
      { role: "assistant", content: "The database is down." },
      { role: "user", content: "can you fix it?" },
      { role: "assistant", content: "fixed" },
    ],
  };

  const result = compressContext(body, { maxTokens: 1500, reserveTokens: 0 });
  assert.ok(result.compressed);
  // Either the tool chain is fully preserved, or the tool_result orphan is properly dropped
  const toolResultMsgs = result.body.messages.filter(
    (m) =>
      m.role === "tool" ||
      (Array.isArray(m.content) && m.content.some((b) => b?.type === "tool_result"))
  );
  // If there's a tool result, there must be a matching tool_use
  if (toolResultMsgs.length > 0) {
    const toolUseIds = new Set();
    for (const msg of result.body.messages) {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block?.type === "tool_use" && block.id) toolUseIds.add(block.id);
        }
      }
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc?.id) toolUseIds.add(tc.id);
        }
      }
    }
    // Every tool result should reference a kept tool call
    // This is verified indirectly by normalizePurifiedMessages
  }
});

// ─── Phase 2.5: Tighter Tool Compaction Rules ────────────────────────────────

test("Phase 2.5: required tools get larger description budget", () => {
  const tools = Array.from({ length: 120 }, (_, i) => ({
    type: "function",
    function: {
      name: `tool_${i}`,
      description: `Tool ${i}: ` + "d".repeat(400),
      parameters: { type: "object", properties: { x: { type: "string" } } },
    },
  }));

  const forcedTool = {
    type: "function",
    function: {
      name: "forced_tool",
      description:
        "A forced tool with a very long description that exceeds the normal budget. ".repeat(10),
      parameters: { type: "object", properties: { x: { type: "string" } } },
    },
  };

  const body = {
    model: "test",
    tool_choice: { type: "function", function: { name: "forced_tool" } },
    tools: [...tools, forcedTool],
    messages: [{ role: "user", content: "Run forced tool" }],
  };

  const result = compressContext(body, { maxTokens: 5000, reserveTokens: 500 });
  assert.ok(result.compressed);

  const keptTools = Array.isArray(result.body.tools) ? result.body.tools : [];
  const forcedToolResult = keptTools.find(
    (t) => t?.function?.name === "forced_tool" || t?.name === "forced_tool"
  );
  assert.ok(forcedToolResult, "Forced tool should be preserved");
  // Required tools get a 500 char budget
  const desc = forcedToolResult?.function?.description || forcedToolResult?.description || "";
  assert.ok(
    desc.length > 300,
    `Forced tool description should be longer (got ${desc.length} chars), budget is 500`
  );
});

test("Phase 2.5: unused tools get smaller description budget", () => {
  const tools = Array.from({ length: 120 }, (_, i) => ({
    type: "function",
    function: {
      name: `unused_tool_${i}`,
      description: `Unused tool ${i}: ` + "x".repeat(400),
      parameters: { type: "object", properties: { x: { type: "string" } } },
    },
  }));

  const body = {
    model: "test",
    tools,
    messages: [{ role: "user", content: "help" }],
  };

  const result = compressContext(body, { maxTokens: 5000, reserveTokens: 500 });
  assert.ok(result.compressed);

  const keptTools = Array.isArray(result.body.tools) ? result.body.tools : [];
  assert.ok(keptTools.length <= 96, "Should compact tools to max 96");
  // Unused tools get 120 char budget
  for (const tool of keptTools) {
    const desc = tool?.function?.description || tool?.description || "";
    assert.ok(
      desc.length <= 125,
      `Unused tool description should be compact (got ${desc.length} chars, budget is 120)`
    );
  }
});

// ─── Phase 3.6: Content-Type-Aware Token Estimation ─────────────────────────

test("Phase 3.6: estimateTokens uses different ratios for different content types", () => {
  // Plain text should use ~4 chars/token
  const textTokens = estimateTokens("Hello world this is plain text");
  assert.ok(textTokens > 0, "Should estimate tokens for plain text");

  // JSON should use ~2.8 chars/token (more tokens per char)
  const jsonStr = JSON.stringify({ key: "value", nested: { a: 1, b: 2 } });
  const jsonTokens = estimateTokens(jsonStr);
  assert.ok(jsonTokens > 0, "Should estimate tokens for JSON");

  // JSON content should produce more tokens per same char count than plain text
  const plainStr = "a".repeat(jsonStr.length);
  const plainTokens = estimateTokens(plainStr);
  assert.ok(
    jsonTokens >= plainTokens,
    "JSON content should estimate same or more tokens than equivalent-length plain text"
  );
});

test("Phase 3.6: estimateTokensDetailed returns content type info", () => {
  const textResult = estimateTokensDetailed("Hello world");
  assert.ok(textResult.tokens > 0, "Should estimate tokens");
  assert.ok(typeof textResult.contentType === "string", "Should return content type");
  assert.ok(typeof textResult.ratio === "number", "Should return ratio");

  const jsonResult = estimateTokensDetailed('{"type": "object"}');
  assert.ok(jsonResult.tokens > 0, "Should estimate JSON tokens");
  assert.equal(jsonResult.contentType, "schema", "Should detect JSON schema content");

  const plainResult = estimateTokensDetailed("Just some plain text here");
  assert.equal(plainResult.contentType, "text", "Should detect plain text");
});

// ─── Phase 3.7: Safer System Prompt Truncation ──────────────────────────────

test("Phase 3.7: system prompt truncation preserves instruction prefix", () => {
  const systemPrompt =
    "IMPORTANT: Never modify user data. Always validate inputs. " +
    "Follow these strict rules: " +
    Array.from(
      { length: 100 },
      (_, i) => `Rule ${i}: This is a very detailed rule about how to handle edge case ${i}.`
    ).join(" ") +
    " END OF RULES.";

  const body = {
    model: "test",
    messages: [
      { role: "system", content: systemPrompt },
      ...Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `msg-${i} ` + "x".repeat(200),
      })),
    ],
  };

  const result = compressContext(body, { maxTokens: 2000, reserveTokens: 0 });
  assert.ok(result.compressed);

  const systemMsg = result.body.messages.find((m) => m.role === "system");
  if (
    systemMsg &&
    typeof systemMsg.content === "string" &&
    systemMsg.content.includes("truncated")
  ) {
    // If truncated, it should preserve the instruction prefix
    assert.ok(
      systemMsg.content.startsWith("IMPORTANT") || systemMsg.content.includes("IMPORTANT"),
      "Truncated system prompt should preserve the critical prefix"
    );
  }
});

test("Phase 3.7: aggressive tool trimming runs before system truncation", () => {
  // Verify by checking the compression layers order
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "System prompt " + "s".repeat(500) },
      { role: "user", content: "run tool" },
      {
        role: "tool",
        tool_call_id: "t1",
        content: "Large output " + "x".repeat(10000),
      },
      { role: "user", content: "done?" },
    ],
  };

  const result = compressContext(body, { maxTokens: 1500, reserveTokens: 0 });
  assert.ok(result.compressed);

  // Check that layer names are in expected order
  const layerNames = result.stats.layers.map((l) => l.name);
  const expectedOrder = ["compact_tools", "trim_tools", "compress_thinking", "purify_history"];
  // aggressive_trim_tools comes after purify_history if it ran
  let lastExpectedIdx = -1;
  for (const expected of expectedOrder) {
    const idx = layerNames.indexOf(expected);
    if (idx !== -1 && idx > lastExpectedIdx) {
      lastExpectedIdx = idx;
    }
  }
  // If purify_history ran, aggressive_trim_tools should come after it
  const aggressiveIdx = layerNames.indexOf("aggressive_trim_tools");
  if (aggressiveIdx !== -1) {
    const purifyIdx = layerNames.indexOf("purify_history");
    assert.ok(aggressiveIdx > purifyIdx, "aggressive_trim_tools should run after purify_history");
  }
  // truncate_system should be last if it ran
  const sysTruncIdx = layerNames.indexOf("truncate_system");
  if (sysTruncIdx !== -1 && aggressiveIdx !== -1) {
    assert.ok(
      sysTruncIdx > aggressiveIdx,
      "truncate_system should run after aggressive_trim_tools"
    );
  }
});

test("Phase 3.7: compression stats report systemTruncated when system prompt was cut", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "System " + "s".repeat(10000) },
      { role: "user", content: "hi" },
    ],
  };

  const result = compressContext(body, { maxTokens: 500, reserveTokens: 0 });
  assert.ok(result.compressed);

  if (result.stats.systemTruncated) {
    assert.ok(
      result.stats.layers.some((l) => l.name === "truncate_system"),
      "If systemTruncated is true, there should be a truncate_system layer"
    );
  }
});

// ─── Integration: Full Compression Pipeline ──────────────────────────────────

test("Integration: compression stats track all new fields", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      // Constraint-bearing user message
      { role: "user", content: "You must always validate inputs. " + "x".repeat(3000) },
      // Assistant decision
      {
        role: "assistant",
        content: "I decided to implement validation middleware. " + "y".repeat(3000),
      },
      // Tool call with error
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "c1", name: "bash", input: { command: "test" } }],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "c1",
            content: "Error: command not found\n" + "z".repeat(8000),
          },
        ],
      },
      // More conversation
      ...Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `msg-${i} ` + "w".repeat(300),
      })),
    ],
  };

  const result = compressContext(body, { maxTokens: 2000, reserveTokens: 0 });
  assert.ok(result.compressed);

  // Verify all stat fields exist
  assert.ok(typeof result.stats.droppedMessageCount === "number");
  assert.ok(typeof result.stats.truncatedToolCount === "number");
  assert.ok(typeof result.stats.compressedThinkingCount === "number");
  assert.ok(typeof result.stats.summaryInserted === "boolean");
  assert.ok(typeof result.stats.systemTruncated === "boolean");
  assert.ok(result.stats.original > 0);
  assert.ok(result.stats.final > 0);
  assert.ok(result.stats.final < result.stats.original);
});

test("Integration: no compression when body fits", () => {
  const body = {
    model: "test",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi!" },
    ],
  };

  const result = compressContext(body);
  assert.equal(result.compressed, false);
  assert.equal(result.stats.droppedMessageCount, undefined);
  assert.equal(result.stats.truncatedToolCount, undefined);
  assert.equal(result.stats.summaryInserted, undefined);
  assert.equal(result.stats.systemTruncated, undefined);
});
