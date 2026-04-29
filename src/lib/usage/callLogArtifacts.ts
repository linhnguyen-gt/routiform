import fs from "fs";
import path from "path";
import { CALL_LOGS_DIR } from "./migrations";
export const MAX_CALL_LOG_ARTIFACT_BYTES = 2 * 1024 * 1024;

export type CallLogArtifact = {
  schemaVersion: 3;
  summary: {
    id: string;
    timestamp: string;
    method: string;
    path: string;
    status: number;
    model: string;
    requestedModel: string | null;
    provider: string;
    account: string;
    connectionId: string | null;
    duration: number;
    tokens: {
      in: number;
      out: number;
      cacheRead: number | null;
      cacheCreation: number | null;
      reasoning: number | null;
      promptDetails: Record<string, unknown> | null;
      completionDetails: Record<string, unknown> | null;
    };
    requestType: string | null;
    sourceFormat: string | null;
    targetFormat: string | null;
    apiKeyId: string | null;
    apiKeyName: string | null;
    comboName: string | null;
  };
  requestBody: unknown;
  responseBody: unknown;
  error: unknown;
  pipeline?: Record<string, unknown>;
};

function truncateArtifactForStorage(artifact: CallLogArtifact): CallLogArtifact {
  const pipeline = artifact.pipeline as Record<string, unknown> | undefined;
  const streamChunks = pipeline?.streamChunks as
    | { provider?: string[]; openai?: string[]; client?: string[] }
    | undefined;
  if (!streamChunks) return artifact;

  const truncateField = (arr?: string[]) =>
    Array.isArray(arr) && arr.length > 0
      ? ["[stream chunks omitted: call log artifact size limit exceeded]"]
      : undefined;

  return {
    ...artifact,
    pipeline: {
      ...pipeline,
      streamChunks: {
        provider: truncateField(streamChunks.provider),
        openai: truncateField(streamChunks.openai),
        client: truncateField(streamChunks.client),
      },
    },
  };
}

function omitOversizedPipeline(artifact: CallLogArtifact): CallLogArtifact {
  if (!artifact.pipeline) return artifact;
  const pipeline = artifact.pipeline as Record<string, unknown>;
  const trimmedPipeline: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(pipeline)) {
    if (key === "streamChunks") {
      trimmedPipeline[key] = value;
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (obj.body && typeof obj.body === "object" && !Array.isArray(obj.body)) {
        const bodyRecord = obj.body as Record<string, unknown>;
        if ("messages" in bodyRecord && Array.isArray(bodyRecord.messages)) {
          const msgCount = bodyRecord.messages.length;
          const firstMsg = truncateString(JSON.stringify(bodyRecord.messages[0]).slice(0, 200));
          const lastMsg = truncateString(
            JSON.stringify(bodyRecord.messages[msgCount - 1]).slice(0, 200)
          );
          trimmedPipeline[key] = {
            ...obj,
            body: {
              ...bodyRecord,
              messages: `[${msgCount} messages truncated — call log artifact size limit exceeded]`,
              _sample: { first: firstMsg, last: lastMsg },
            },
          };
          continue;
        }
      }
    }
    trimmedPipeline[key] = value;
  }
  return { ...artifact, pipeline: trimmedPipeline };
}

function truncateString(value: unknown, maxLength = 256): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...[truncated]`;
}

function serializeArtifactForStorage(artifact: CallLogArtifact): string {
  const serialized = JSON.stringify(artifact, null, 2);
  if (Buffer.byteLength(serialized, "utf8") <= MAX_CALL_LOG_ARTIFACT_BYTES) return serialized;

  const truncatedChunks = JSON.stringify(truncateArtifactForStorage(artifact), null, 2);
  if (Buffer.byteLength(truncatedChunks, "utf8") <= MAX_CALL_LOG_ARTIFACT_BYTES) {
    return truncatedChunks;
  }

  const withoutPipeline = JSON.stringify(omitOversizedPipeline(artifact), null, 2);
  if (Buffer.byteLength(withoutPipeline, "utf8") <= MAX_CALL_LOG_ARTIFACT_BYTES) {
    return withoutPipeline;
  }

  const minimal = JSON.stringify(
    {
      ...omitOversizedPipeline(artifact),
      requestBody: "[omitted: call log artifact size limit exceeded]",
      responseBody: "[omitted: call log artifact size limit exceeded]",
      error: artifact.error ? "[omitted: call log artifact size limit exceeded]" : null,
    },
    null,
    2
  );
  if (Buffer.byteLength(minimal, "utf8") <= MAX_CALL_LOG_ARTIFACT_BYTES) {
    return minimal;
  }

  const hardMin = JSON.stringify(
    {
      schemaVersion: artifact.schemaVersion,
      summary: {
        id: truncateString(artifact.summary?.id, 128),
        timestamp: truncateString(artifact.summary?.timestamp, 64),
        method: truncateString(artifact.summary?.method, 32),
        path: truncateString(artifact.summary?.path, 256),
        status: typeof artifact.summary?.status === "number" ? artifact.summary.status : Number.NaN,
        model: truncateString(artifact.summary?.model, 128),
        provider: truncateString(artifact.summary?.provider, 64),
      },
      requestBody: "[omitted: call log artifact size limit exceeded]",
      responseBody: "[omitted: call log artifact size limit exceeded]",
      error: artifact.error ? "[omitted: call log artifact size limit exceeded]" : null,
      pipeline: {
        error: {
          _routiform_truncated: true,
          reason: "call_log_artifact_size_limit_exceeded",
        },
      },
    },
    null,
    2
  );
  if (Buffer.byteLength(hardMin, "utf8") <= MAX_CALL_LOG_ARTIFACT_BYTES) return hardMin;

  // Guaranteed smallest valid fallback.
  return JSON.stringify({
    schemaVersion: 3,
    summary: {
      id: "truncated",
      timestamp: new Date().toISOString(),
      method: "POST",
      path: "[truncated]",
      status: 500,
      model: "[truncated]",
      provider: "[truncated]",
    },
    requestBody: "[omitted]",
    responseBody: "[omitted]",
    error: "[omitted]",
    pipeline: {
      error: { _routiform_truncated: true, reason: "call_log_artifact_size_limit_exceeded" },
    },
  });
}

export function buildArtifactRelativePath(timestamp: string, id: string): string {
  const parsed = new Date(timestamp);
  const safeTimestamp = (
    Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
  ).replace(/[:]/g, "-");
  const dateFolder = safeTimestamp.slice(0, 10);
  return path.posix.join(dateFolder, `${safeTimestamp}_${id}.json`);
}

export function writeCallArtifact(artifact: CallLogArtifact, onWrite?: () => void): string | null {
  if (!CALL_LOGS_DIR) return null;

  const relPath = buildArtifactRelativePath(artifact.summary.timestamp, artifact.summary.id);
  const absPath = path.join(CALL_LOGS_DIR, relPath);

  try {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, serializeArtifactForStorage(artifact));
    onWrite?.();
    return relPath;
  } catch (error) {
    console.error("[callLogs] Failed to write request artifact:", (error as Error).message);
    return null;
  }
}

export function readCallArtifact(relativePath: string | null): CallLogArtifact | null {
  if (!CALL_LOGS_DIR || !relativePath) return null;

  try {
    const absPath = path.join(CALL_LOGS_DIR, relativePath);
    if (!fs.existsSync(absPath)) return null;
    return JSON.parse(fs.readFileSync(absPath, "utf8")) as CallLogArtifact;
  } catch (error) {
    console.error("[callLogs] Failed to read request artifact:", (error as Error).message);
    return null;
  }
}
