import { getDbInstance } from "../db/core";
import { Memory, MemoryConfig, MemoryType } from "./types";
import { MemoryConfigSchema } from "./schemas";

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toMemory(row: Record<string, unknown>): Memory {
  return {
    id: String(row.id || ""),
    apiKeyId: typeof row.api_key_id === "string" ? row.api_key_id : "",
    sessionId: typeof row.session_id === "string" ? row.session_id : "",
    type: row.type as MemoryType,
    key: typeof row.key === "string" ? row.key : "",
    content: typeof row.content === "string" ? row.content : "",
    metadata: parseMetadata(row.metadata),
    createdAt: new Date(String(row.created_at || "")),
    updatedAt: new Date(String(row.updated_at || "")),
    expiresAt: row.expires_at ? new Date(String(row.expires_at)) : null,
  };
}

function normalizeSearchTerms(searchText: string | undefined): string[] {
  if (!searchText || typeof searchText !== "string") return [];
  return searchText
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9_*]/g, ""))
    .filter((term) => term.length >= 2)
    .slice(0, 8);
}

function buildFtsMatchQuery(searchText: string | undefined): string | null {
  const terms = normalizeSearchTerms(searchText);
  if (terms.length === 0) return null;
  return terms.map((term) => `${term}*`).join(" OR ");
}

function sortAndBudget(memories: Memory[], maxTokens: number): Memory[] {
  const sorted = [...memories].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const budgeted: Memory[] = [];
  let totalTokens = 0;

  for (const memory of sorted) {
    const memoryTokens = estimateTokens(memory.content);
    if (totalTokens + memoryTokens > maxTokens) {
      if (budgeted.length === 0) {
        budgeted.push(memory);
      }
      break;
    }
    budgeted.push(memory);
    totalTokens += memoryTokens;
  }

  return budgeted;
}

function dedupeById(memories: Memory[]): Memory[] {
  const seen = new Set<string>();
  const deduped: Memory[] = [];
  for (const memory of memories) {
    if (seen.has(memory.id)) continue;
    seen.add(memory.id);
    deduped.push(memory);
  }
  return deduped;
}

async function fetchRecentMemories(
  apiKeyId: string,
  retentionDays: number,
  limit: number
): Promise<Memory[]> {
  const db = getDbInstance();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = db
    .prepare(
      `
        SELECT *
        FROM memories
        WHERE api_key_id = ?
          AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
          AND datetime(created_at) >= datetime(?)
        ORDER BY datetime(created_at) DESC
        LIMIT ?
      `
    )
    .all(apiKeyId, cutoff, limit) as Array<Record<string, unknown>>;
  return rows.map(toMemory);
}

async function fetchSemanticMemories(
  apiKeyId: string,
  retentionDays: number,
  limit: number,
  searchText?: string
): Promise<Memory[]> {
  const matchQuery = buildFtsMatchQuery(searchText);
  if (!matchQuery) return [];

  const db = getDbInstance();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = db
    .prepare(
      `
        SELECT m.*
        FROM memories_fts
        JOIN memories m ON m.id = memories_fts.id
        WHERE memories_fts.api_key_id = ?
          AND memories_fts MATCH ?
          AND (m.expires_at IS NULL OR datetime(m.expires_at) > datetime('now'))
          AND datetime(m.created_at) >= datetime(?)
        ORDER BY bm25(memories_fts), datetime(m.created_at) DESC
        LIMIT ?
      `
    )
    .all(apiKeyId, matchQuery, cutoff, limit) as Array<Record<string, unknown>>;

  return rows.map(toMemory);
}

export function estimateTokens(text: string): number {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

export async function retrieveMemories(
  apiKeyId: string,
  config: Partial<MemoryConfig> & { searchText?: string } = {}
): Promise<Memory[]> {
  const normalizedConfig = MemoryConfigSchema.parse({
    enabled: true,
    maxTokens: 2000,
    retrievalStrategy: "exact",
    autoSummarize: false,
    persistAcrossModels: false,
    retentionDays: 30,
    scope: "apiKey",
    ...config,
  });

  if (!normalizedConfig.enabled || normalizedConfig.maxTokens <= 0) {
    return [];
  }

  const maxTokens = Math.min(Math.max(normalizedConfig.maxTokens, 100), 8000);
  const limit = 100;
  const strategy = normalizedConfig.retrievalStrategy;
  const searchText = typeof config.searchText === "string" ? config.searchText : undefined;

  if (strategy === "exact") {
    const recent = await fetchRecentMemories(apiKeyId, normalizedConfig.retentionDays, limit);
    return sortAndBudget(recent, maxTokens);
  }

  if (strategy === "semantic") {
    const semantic = await fetchSemanticMemories(
      apiKeyId,
      normalizedConfig.retentionDays,
      limit,
      searchText
    );
    return sortAndBudget(semantic, maxTokens);
  }

  const [semantic, recent] = await Promise.all([
    fetchSemanticMemories(apiKeyId, normalizedConfig.retentionDays, limit, searchText),
    fetchRecentMemories(apiKeyId, normalizedConfig.retentionDays, limit),
  ]);

  const merged = dedupeById([...semantic, ...recent]);
  return sortAndBudget(merged, maxTokens);
}
