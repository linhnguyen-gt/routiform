import { logAuditEvent } from "./index";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function sanitizeProviderValue(value: unknown): unknown {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length > 2000) return normalized.slice(0, 2000);
    return normalized;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeProviderValue(item));
  }

  if (value && typeof value === "object") {
    const record = asRecord(value);
    const output: JsonRecord = {};
    let count = 0;
    for (const [key, inner] of Object.entries(record)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("token") ||
        lower.includes("secret") ||
        lower.includes("apikey") ||
        lower.includes("api_key") ||
        lower.includes("password") ||
        lower.includes("cookie")
      ) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = sanitizeProviderValue(inner);
      }
      count++;
      if (count >= 100) break;
    }
    return output;
  }

  return value;
}

export function buildProviderAuditMetadata(input: {
  provider: string;
  connectionId?: string | null;
  actor?: string | null;
  ipAddress?: string | null;
  action: string;
  details?: unknown;
}): {
  action: string;
  actor: string;
  target: string;
  details: unknown;
  ipAddress?: string;
} {
  const provider = String(input.provider || "unknown").trim() || "unknown";
  const connectionId = input.connectionId ? String(input.connectionId).trim() : "";
  return {
    action: input.action,
    actor: input.actor && input.actor.trim().length > 0 ? input.actor.trim() : "system",
    target: connectionId ? `provider:${provider}:${connectionId}` : `provider:${provider}`,
    details: sanitizeProviderValue(input.details || {}),
    ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
  };
}

export function logProviderAuditEvent(input: {
  provider: string;
  connectionId?: string | null;
  actor?: string | null;
  ipAddress?: string | null;
  action: string;
  details?: unknown;
}): void {
  const metadata = buildProviderAuditMetadata(input);
  logAuditEvent({
    action: metadata.action,
    actor: metadata.actor,
    target: metadata.target,
    details: metadata.details,
    ipAddress: metadata.ipAddress,
  });
}
