import { createHash } from "crypto";
import {
  getApiKeys,
  getCombos,
  getModelAliases,
  getProviderConnections,
  getSettings,
} from "@/lib/localDb";
import { logAuditEvent } from "@/lib/compliance";
import { getClientIpFromRequest } from "@/lib/ipUtils";
import type { SyncTokenRecord } from "@/lib/db/syncTokens";

type BundleObject = Record<string, unknown>;

const REDACTED = "[REDACTED]";

const SECRET_KEY_PATTERN =
  /(api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|password|secret|authorization|token_hash|tokenHash)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (isRecord(value)) {
    const output: BundleObject = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        output[key] = REDACTED;
      } else {
        output[key] = redactSecrets(nested);
      }
    }
    return output;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return String(value);
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item));
  }

  if (isRecord(value)) {
    const sorted: BundleObject = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = sortKeysDeep(redactSecrets(value[key]));
    }
    return sorted;
  }

  return value;
}

function computeEtag(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  const digest = createHash("sha256").update(serialized).digest("hex");
  return `"${digest}"`;
}

function withDefaultSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const cloned: Record<string, unknown> = { ...settings };
  delete cloned.password;
  return cloned;
}

function redactApiKeyRows(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    if (!isRecord(entry)) return entry;
    return {
      ...entry,
      ...(Object.prototype.hasOwnProperty.call(entry, "key") ? { key: REDACTED } : {}),
    };
  });
}

function isEtagMatch(headerValue: string | null, etag: string): boolean {
  if (!headerValue) return false;

  const candidates = headerValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.startsWith("W/") ? value.slice(2) : value));

  return candidates.includes("*") || candidates.includes(etag);
}

export type SyncBundlePayload = {
  settings: unknown;
  providers: unknown;
  modelAliases: unknown;
  combos: unknown;
  apiKeys: unknown;
};

export async function buildSyncBundlePayload(): Promise<SyncBundlePayload> {
  const [settings, providers, modelAliases, combos, apiKeys] = await Promise.all([
    getSettings(),
    getProviderConnections(),
    getModelAliases(),
    getCombos(),
    getApiKeys(),
  ]);

  const payload: SyncBundlePayload = {
    settings: withDefaultSettings(settings),
    providers,
    modelAliases,
    combos,
    apiKeys: redactApiKeyRows(apiKeys),
  };

  return sortKeysDeep(payload) as SyncBundlePayload;
}

export async function buildSyncBundleResponse(
  request: Request,
  tokenRecord: SyncTokenRecord
): Promise<
  { status: 304; etag: string } | { status: 200; etag: string; payload: SyncBundlePayload }
> {
  const payload = await buildSyncBundlePayload();
  const etag = computeEtag(payload);

  if (isEtagMatch(request.headers.get("if-none-match"), etag)) {
    logAuditEvent({
      action: "sync.bundle.read_not_modified",
      actor: `sync-token:${tokenRecord.id}`,
      target: "sync_bundle",
      details: { tokenId: tokenRecord.id, tokenPrefix: tokenRecord.tokenPrefix },
      ipAddress: getClientIpFromRequest(request),
    });
    return { status: 304, etag };
  }

  logAuditEvent({
    action: "sync.bundle.read",
    actor: `sync-token:${tokenRecord.id}`,
    target: "sync_bundle",
    details: {
      tokenId: tokenRecord.id,
      tokenPrefix: tokenRecord.tokenPrefix,
      providersCount: Array.isArray(payload.providers) ? payload.providers.length : 0,
      apiKeysCount: Array.isArray(payload.apiKeys) ? payload.apiKeys.length : 0,
    },
    ipAddress: getClientIpFromRequest(request),
  });

  return { status: 200, etag, payload };
}
