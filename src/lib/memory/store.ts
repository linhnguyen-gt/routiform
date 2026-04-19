/**
 * Memory store - CRUD operations backed by canonical `memories` table.
 */

import { randomUUID } from "crypto";
import { getDbInstance } from "../db/core";
import { Memory, MemoryType } from "./types";

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

const MEMORY_CACHE_TTL = 300_000;
const MEMORY_MAX_CACHE_SIZE = 10_000;
const MEMORY_VALIDATION_CACHE_TTL = 60_000;

const _memoryCache = new Map<string, CacheEntry<Memory | null>>();
const _memoryValidationCache = new Map<string, { exists: boolean; timestamp: number }>();

function parseJSON(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function invalidateMemoryCache(id: string): void {
  _memoryCache.delete(id);
  _memoryValidationCache.delete(id);
}

function evictIfNeeded<TKey, TValue>(cache: Map<TKey, TValue>): void {
  if (cache.size <= MEMORY_MAX_CACHE_SIZE) return;
  const keysArray = Array.from(cache.keys());
  const entriesToRemove = Math.max(1, Math.floor(cache.size * 0.2));
  for (let i = 0; i < entriesToRemove; i += 1) {
    cache.delete(keysArray[i]);
  }
}

function mapRowToMemory(row: Record<string, unknown>): Memory {
  return {
    id: String(row.id || ""),
    apiKeyId: typeof row.api_key_id === "string" ? row.api_key_id : "",
    sessionId: typeof row.session_id === "string" ? row.session_id : "",
    type: row.type as MemoryType,
    key: typeof row.key === "string" ? row.key : "",
    content: typeof row.content === "string" ? row.content : "",
    metadata: parseJSON(row.metadata),
    createdAt: new Date(String(row.created_at || "")),
    updatedAt: new Date(String(row.updated_at || "")),
    expiresAt: row.expires_at ? new Date(String(row.expires_at)) : null,
  };
}

async function memoryExists(id: string): Promise<boolean> {
  if (!id || typeof id !== "string") return false;
  const now = Date.now();
  const cached = _memoryValidationCache.get(id);
  if (cached && now - cached.timestamp < MEMORY_VALIDATION_CACHE_TTL) {
    return cached.exists;
  }

  const db = getDbInstance();
  const row = db.prepare("SELECT 1 FROM memories WHERE id = ?").get(id);
  const exists = Boolean(row);
  if (exists) {
    _memoryValidationCache.set(id, { exists, timestamp: now });
  }
  return exists;
}

export async function createMemory(
  memory: Omit<Memory, "id" | "createdAt" | "updatedAt">
): Promise<Memory> {
  const db = getDbInstance();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO memories (
        id, api_key_id, session_id, type, key, content, metadata, created_at, updated_at, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    memory.apiKeyId,
    memory.sessionId || null,
    memory.type,
    memory.key,
    memory.content,
    JSON.stringify(memory.metadata || {}),
    now,
    now,
    memory.expiresAt?.toISOString() ?? null
  );

  const createdMemory: Memory = {
    id,
    apiKeyId: memory.apiKeyId,
    sessionId: memory.sessionId,
    type: memory.type,
    key: memory.key,
    content: memory.content,
    metadata: memory.metadata || {},
    createdAt: new Date(now),
    updatedAt: new Date(now),
    expiresAt: memory.expiresAt ?? null,
  };

  invalidateMemoryCache(id);
  evictIfNeeded(_memoryCache);
  _memoryCache.set(id, { value: createdMemory, timestamp: Date.now() });

  return createdMemory;
}

export async function getMemory(id: string): Promise<Memory | null> {
  if (!id || typeof id !== "string") return null;

  const cached = _memoryCache.get(id);
  if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
    return cached.value;
  }

  const db = getDbInstance();
  const row = db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as Record<string, unknown>;
  if (!row) {
    evictIfNeeded(_memoryCache);
    _memoryCache.set(id, { value: null, timestamp: Date.now() });
    return null;
  }

  const memory = mapRowToMemory(row);
  evictIfNeeded(_memoryCache);
  _memoryCache.set(id, { value: memory, timestamp: Date.now() });
  return memory;
}

export async function updateMemory(
  id: string,
  updates: Partial<Omit<Memory, "id" | "createdAt">>
): Promise<boolean> {
  if (!id || typeof id !== "string") return false;
  if (!(await memoryExists(id))) return false;

  const db = getDbInstance();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.type !== undefined) {
    fields.push("type = ?");
    values.push(updates.type);
  }
  if (updates.key !== undefined) {
    fields.push("key = ?");
    values.push(updates.key);
  }
  if (updates.content !== undefined) {
    fields.push("content = ?");
    values.push(updates.content);
  }
  if (updates.metadata !== undefined) {
    fields.push("metadata = ?");
    values.push(JSON.stringify(updates.metadata));
  }
  if (updates.expiresAt !== undefined) {
    fields.push("expires_at = ?");
    values.push(updates.expiresAt?.toISOString() ?? null);
  }

  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  const result = db.prepare(`UPDATE memories SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  if ((result.changes || 0) === 0) return false;

  invalidateMemoryCache(id);
  return true;
}

export async function deleteMemory(id: string): Promise<boolean> {
  if (!id || typeof id !== "string") return false;
  const db = getDbInstance();
  const result = db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  if ((result.changes || 0) === 0) return false;
  invalidateMemoryCache(id);
  return true;
}

export async function listMemories(filters: {
  apiKeyId?: string;
  type?: MemoryType;
  sessionId?: string;
  limit?: number;
  offset?: number;
}): Promise<Memory[]> {
  const db = getDbInstance();

  let query = "SELECT * FROM memories";
  const params: unknown[] = [];
  const whereClauses: string[] = [];

  if (filters.apiKeyId) {
    whereClauses.push("api_key_id = ?");
    params.push(filters.apiKeyId);
  }
  if (filters.type) {
    whereClauses.push("type = ?");
    params.push(filters.type);
  }
  if (filters.sessionId) {
    whereClauses.push("session_id = ?");
    params.push(filters.sessionId);
  }
  whereClauses.push("(expires_at IS NULL OR datetime(expires_at) > datetime('now'))");

  query += ` WHERE ${whereClauses.join(" AND ")}`;
  query += " ORDER BY datetime(created_at) DESC";

  if (filters.limit !== undefined) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }
  if (filters.offset !== undefined) {
    query += " OFFSET ?";
    params.push(filters.offset);
  }

  const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(mapRowToMemory);
}
