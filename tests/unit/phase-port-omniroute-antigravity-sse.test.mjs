import test from "node:test";
import assert from "node:assert/strict";

import { AntigravityExecutor } from "../../open-sse/executors/antigravity.ts";

function streamFromChunks(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test("port plan: Antigravity non-stream collector handles split SSE lines", async () => {
  const payload1 = JSON.stringify({
    response: {
      candidates: [{ content: { parts: [{ text: "Hello " }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 12 },
    },
  });
  const payload2 = JSON.stringify({
    response: {
      candidates: [{ content: { parts: [{ text: "world" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, totalTokenCount: 13 },
    },
    remainingCredits: [{ creditType: "GOOGLE_ONE_AI", creditAmount: "12345" }],
  });

  const response = new Response(
    streamFromChunks([
      `data: ${payload1.slice(0, 20)}`,
      `${payload1.slice(20)}\n`,
      `data: ${payload2.slice(0, 15)}`,
      `${payload2.slice(15)}\n`,
      "data: [DONE]\n",
    ]),
    { status: 200, headers: { "content-type": "text/event-stream" } }
  );

  const executor = new AntigravityExecutor();
  const out = await executor.collectStreamToResponse(
    response,
    "claude-sonnet-4-6",
    "https://example.com",
    {},
    {}
  );

  const json = await out.response.json();
  assert.equal(json.choices[0].message.content, "Hello world");
  assert.equal(json.choices[0].finish_reason, "stop");
  assert.deepEqual(json.usage, {
    prompt_tokens: 10,
    completion_tokens: 3,
    total_tokens: 13,
  });
  assert.equal(json._remainingCredits[0].creditType, "GOOGLE_ONE_AI");
});
