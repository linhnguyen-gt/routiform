import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("port plan: requestLogger caps stream chunk items", async () => {
  const { createRequestLogger } = await import("../../open-sse/utils/requestLogger.ts");
  const logger = await createRequestLogger("openai", "openai", "gpt-4o", {
    maxStreamChunkItems: 3,
    maxStreamChunkBytes: 4096,
  });

  logger.appendProviderChunk("chunk-1");
  logger.appendProviderChunk("chunk-2");
  logger.appendProviderChunk("chunk-3");
  logger.appendProviderChunk("chunk-4");
  logger.appendProviderChunk("chunk-5");

  const payloads = logger.getPipelinePayloads();
  assert.ok(payloads?.streamChunks?.provider);
  assert.equal(payloads.streamChunks.provider.length, 3);
  assert.match(payloads.streamChunks.provider[2], /truncated after 3 chunks/i);
});

test("port plan: callLogArtifacts serializes oversized artifacts safely", async () => {
  const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-artifact-bounds-"));
  const oldDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = testDataDir;

  try {
    const { writeCallArtifact, MAX_CALL_LOG_ARTIFACT_BYTES } = await import(
      `../../src/lib/usage/callLogArtifacts.ts?t=${Date.now()}`
    );

    const artifact = {
      schemaVersion: 3,
      summary: {
        id: `artifact-${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: "POST",
        path: "/v1/chat/completions",
        status: 200,
        model: "gpt-4o",
        requestedModel: "gpt-4o",
        provider: "openai",
        account: "test",
        connectionId: "conn",
        duration: 12,
        tokens: {
          in: 1,
          out: 1,
          cacheRead: null,
          cacheCreation: null,
          reasoning: null,
          promptDetails: null,
          completionDetails: null,
        },
        requestType: null,
        sourceFormat: "openai",
        targetFormat: "openai",
        apiKeyId: null,
        apiKeyName: null,
        comboName: null,
      },
      requestBody: "x".repeat(800_000),
      responseBody: "y".repeat(800_000),
      error: null,
      pipeline: {
        streamChunks: {
          provider: Array.from({ length: 1000 }, () => "z".repeat(500)),
          openai: ["a".repeat(5000)],
          client: ["b".repeat(5000)],
        },
      },
    };

    const relative = writeCallArtifact(artifact);
    assert.ok(relative);

    const absolute = path.join(testDataDir, "call_logs", relative);
    const size = fs.statSync(absolute).size;
    assert.ok(
      size <= MAX_CALL_LOG_ARTIFACT_BYTES,
      `expected ${size} <= ${MAX_CALL_LOG_ARTIFACT_BYTES}`
    );

    const parsed = JSON.parse(fs.readFileSync(absolute, "utf8"));
    assert.equal(parsed.schemaVersion, 3);
    assert.ok(parsed.summary?.id);
  } finally {
    if (oldDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = oldDataDir;
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});
