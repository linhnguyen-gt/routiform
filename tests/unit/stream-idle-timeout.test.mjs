import test from "node:test";
import assert from "node:assert/strict";

test(
  "SSE idle timeout emits StreamIdleTimeoutError after silence (504-class path for combo fallback)",
  { timeout: 8000 },
  async () => {
    const { createSSEStream } = await import("../../open-sse/utils/stream.ts");
    const { FORMATS } = await import("../../open-sse/translator/formats.ts");

    const sse = createSSEStream({
      mode: "passthrough",
      sourceFormat: FORMATS.OPENAI,
      idleTimeoutMs: 600,
      provider: "unit-test",
      model: "idle-model",
    });

    const enc = new TextEncoder();
    const input = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"ping"}}]}\n\n'));
      },
    });

    const reader = input.pipeThrough(sse).getReader();
    let err = null;
    try {
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch (e) {
      err = e;
    }

    assert.ok(err instanceof Error);
    assert.equal(err.name, "StreamIdleTimeoutError");
    assert.match(err.message, /Idle timeout/i);
  }
);
