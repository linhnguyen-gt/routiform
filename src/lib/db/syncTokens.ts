import { createHash, randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getDbInstance, rowToCamel, cleanNulls } from "./core";
import { backupDbFile } from "./backup";
import { invalidateDbCache } from "./readCache";

type JsonRecord = Record<string, unknown>;

export interface SyncTokenRecord {
  id: string;
  name: string;
  tokenPrefix: string;
  isActive: boolean;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncTokenCreateResult extends SyncTokenRecord {
  token: string;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken(): string {
  return `rst_${randomBytes(24).toString("base64url")}`;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function sanitizeTokenRow(row: unknown): SyncTokenRecord | null {
  const camel = rowToCamel(row);
  if (!camel) return null;
  const cleaned = cleanNulls(camel);
  return {
    id: String(cleaned.id || ""),
    name: String(cleaned.name || ""),
    tokenPrefix: String(cleaned.tokenPrefix || ""),
    isActive: Boolean(cleaned.isActive),
    ...(cleaned.lastUsedAt ? { lastUsedAt: String(cleaned.lastUsedAt) } : {}),
    ...(cleaned.revokedAt ? { revokedAt: String(cleaned.revokedAt) } : {}),
    createdAt: String(cleaned.createdAt || ""),
    updatedAt: String(cleaned.updatedAt || ""),
  };
}

export async function listSyncTokens(): Promise<SyncTokenRecord[]> {
  const db = getDbInstance();
  const rows = db
    .prepare(
      "SELECT id, name, token_prefix, is_active, last_used_at, revoked_at, created_at, updated_at FROM sync_tokens ORDER BY created_at DESC"
    )
    .all();
  return rows
    .map((row) => sanitizeTokenRow(row))
    .filter((row): row is SyncTokenRecord => Boolean(row));
}

export async function getSyncTokenById(id: string): Promise<SyncTokenRecord | null> {
  const db = getDbInstance();
  const row = db
    .prepare(
      "SELECT id, name, token_prefix, is_active, last_used_at, revoked_at, created_at, updated_at FROM sync_tokens WHERE id = ?"
    )
    .get(id);
  return sanitizeTokenRow(row);
}

export async function createSyncToken(name: string): Promise<SyncTokenCreateResult> {
  const db = getDbInstance();
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();
  const id = uuidv4();
  const tokenPrefix = rawToken.slice(0, 12);

  db.prepare(
    `
      INSERT INTO sync_tokens (id, name, token_hash, token_prefix, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `
  ).run(id, name, tokenHash, tokenPrefix, now, now);

  backupDbFile("pre-write");
  invalidateDbCache("settings");

  const created = await getSyncTokenById(id);
  if (!created) {
    throw new Error("Failed to create sync token");
  }

  return {
    ...created,
    token: rawToken,
  };
}

export async function revokeSyncToken(id: string): Promise<boolean> {
  const db = getDbInstance();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      "UPDATE sync_tokens SET is_active = 0, revoked_at = ?, updated_at = ? WHERE id = ? AND is_active = 1"
    )
    .run(now, now, id);
  if ((result.changes || 0) > 0) {
    backupDbFile("pre-write");
    invalidateDbCache("settings");
    return true;
  }
  return false;
}

export async function validateSyncToken(rawToken: string): Promise<SyncTokenRecord | null> {
  if (!rawToken || typeof rawToken !== "string") return null;
  const db = getDbInstance();
  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare(
      "SELECT id, name, token_prefix, is_active, last_used_at, revoked_at, created_at, updated_at FROM sync_tokens WHERE token_hash = ? AND is_active = 1"
    )
    .get(tokenHash);
  return sanitizeTokenRow(row);
}

export async function markSyncTokenUsed(id: string): Promise<void> {
  const db = getDbInstance();
  const now = new Date().toISOString();
  db.prepare("UPDATE sync_tokens SET last_used_at = ?, updated_at = ? WHERE id = ?").run(
    now,
    now,
    id
  );
}

export async function parseSyncAuthorizationHeader(
  request: Request
): Promise<{ token: string | null; malformed: boolean }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return { token: null, malformed: false };
  if (!authHeader.startsWith("Bearer ")) return { token: null, malformed: true };
  const token = authHeader.slice(7).trim();
  return { token: token || null, malformed: token.length === 0 };
}

export async function buildSyncTokenAuditDetails(record: SyncTokenRecord): Promise<JsonRecord> {
  const details = toRecord(record);
  delete details.tokenHash;
  return details;
}
