import fs from "fs";
import path from "path";
import { CALL_LOGS_DIR } from "./migrations";

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
    fs.writeFileSync(absPath, JSON.stringify(artifact, null, 2));
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
