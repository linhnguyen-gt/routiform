import { getDbInstance } from "./core";

export function setReasoningCache(
  toolCallId: string,
  provider: string,
  model: string,
  reasoning: string,
  ttlMs: number
): void {
  if (!toolCallId || !reasoning || ttlMs <= 0) return;
  const db = getDbInstance();
  const expiresAt = Math.floor((Date.now() + ttlMs) / 1000);
  db.prepare(
    `INSERT OR REPLACE INTO reasoning_cache
       (tool_call_id, provider, model, reasoning, char_count, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`
  ).run(toolCallId, provider, model, reasoning, reasoning.length, expiresAt);
}

export function getReasoningCache(
  toolCallId: string,
  provider: string,
  model: string
): { reasoning: string; provider: string; model: string } | null {
  if (!toolCallId || !provider || !model) return null;
  const db = getDbInstance();
  const row = db
    .prepare(
      `SELECT reasoning, provider, model
         FROM reasoning_cache
        WHERE tool_call_id = ?
          AND provider = ?
          AND model = ?
          AND expires_at > unixepoch('now')`
    )
    .get(toolCallId, provider, model) as
    | { reasoning: string; provider: string; model: string }
    | undefined;
  return row ?? null;
}

export function cleanupExpiredReasoning(): number {
  const db = getDbInstance();
  const result = db
    .prepare(`DELETE FROM reasoning_cache WHERE expires_at <= unixepoch('now')`)
    .run();
  return result.changes;
}

export function clearAllReasoningCache(provider?: string): number {
  const db = getDbInstance();
  if (provider) {
    const result = db.prepare(`DELETE FROM reasoning_cache WHERE provider = ?`).run(provider);
    return result.changes;
  }
  const result = db.prepare(`DELETE FROM reasoning_cache`).run();
  return result.changes;
}

export function deleteReasoningCache(
  toolCallId: string,
  provider?: string,
  model?: string
): number {
  if (!toolCallId) return 0;
  const db = getDbInstance();
  if (provider && model) {
    const result = db
      .prepare(`DELETE FROM reasoning_cache WHERE tool_call_id = ? AND provider = ? AND model = ?`)
      .run(toolCallId, provider, model);
    return result.changes;
  }
  const result = db.prepare(`DELETE FROM reasoning_cache WHERE tool_call_id = ?`).run(toolCallId);
  return result.changes;
}

export function getReasoningCacheEntries(
  opts: { limit?: number; offset?: number; provider?: string; model?: string } = {}
): Array<{
  toolCallId: string;
  provider: string;
  model: string;
  reasoning: string;
  charCount: number;
  createdAt: string;
  expiresAt: string;
}> {
  const db = getDbInstance();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const clauses: string[] = [`expires_at > unixepoch('now')`];
  const params: unknown[] = [];
  if (opts.provider) {
    clauses.push("provider = ?");
    params.push(opts.provider);
  }
  if (opts.model) {
    clauses.push("model = ?");
    params.push(opts.model);
  }

  const rows = db
    .prepare(
      `SELECT tool_call_id, provider, model, reasoning, char_count, created_at, expires_at
       FROM reasoning_cache
       WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Array<{
    tool_call_id: string;
    provider: string;
    model: string;
    reasoning: string;
    char_count: number;
    created_at: string;
    expires_at: number;
  }>;

  return rows.map((row) => ({
    toolCallId: row.tool_call_id,
    provider: row.provider,
    model: row.model,
    reasoning: row.reasoning,
    charCount: row.char_count,
    createdAt: row.created_at,
    expiresAt: new Date(row.expires_at * 1000).toISOString(),
  }));
}

export function getReasoningCacheStats(): {
  totalEntries: number;
  totalChars: number;
  byProvider: Record<string, { entries: number; chars: number }>;
  byModel: Record<string, { entries: number; chars: number }>;
  oldestEntry: string | null;
  newestEntry: string | null;
} {
  const db = getDbInstance();
  const totals = db
    .prepare(
      `SELECT COUNT(*) as total_entries, COALESCE(SUM(char_count), 0) as total_chars
       FROM reasoning_cache WHERE expires_at > unixepoch('now')`
    )
    .get() as { total_entries: number; total_chars: number };

  const providerRows = db
    .prepare(
      `SELECT provider, COUNT(*) as entries, COALESCE(SUM(char_count), 0) as chars
       FROM reasoning_cache
       WHERE expires_at > unixepoch('now')
       GROUP BY provider
       ORDER BY entries DESC`
    )
    .all() as Array<{ provider: string; entries: number; chars: number }>;
  const byProvider: Record<string, { entries: number; chars: number }> = {};
  for (const row of providerRows)
    byProvider[row.provider] = { entries: row.entries, chars: row.chars };

  const modelRows = db
    .prepare(
      `SELECT model, COUNT(*) as entries, COALESCE(SUM(char_count), 0) as chars
       FROM reasoning_cache
       WHERE expires_at > unixepoch('now')
       GROUP BY model
       ORDER BY entries DESC`
    )
    .all() as Array<{ model: string; entries: number; chars: number }>;
  const byModel: Record<string, { entries: number; chars: number }> = {};
  for (const row of modelRows) byModel[row.model] = { entries: row.entries, chars: row.chars };

  const oldest = db
    .prepare(
      `SELECT created_at FROM reasoning_cache
       WHERE expires_at > unixepoch('now')
       ORDER BY created_at ASC
       LIMIT 1`
    )
    .get() as { created_at: string } | undefined;
  const newest = db
    .prepare(
      `SELECT created_at FROM reasoning_cache
       WHERE expires_at > unixepoch('now')
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get() as { created_at: string } | undefined;

  return {
    totalEntries: totals.total_entries || 0,
    totalChars: totals.total_chars || 0,
    byProvider,
    byModel,
    oldestEntry: oldest?.created_at ?? null,
    newestEntry: newest?.created_at ?? null,
  };
}
