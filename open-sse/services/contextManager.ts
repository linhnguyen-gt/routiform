// ─── Token estimation ───────────────────────────────────────────────────

export {
  detectContentType,
  estimateTokens,
  estimateTokensDetailed,
  estimateRequestTokens,
  validateContextLimit,
} from "./context-manager/token-estimation.ts";

// ─── Token limits ────────────────────────────────────────────────────────

export {
  getTokenLimit,
  getEffectiveContextLimit,
  getSafeLimit,
} from "./context-manager/token-limits.ts";

// ─── Content compaction ──────────────────────────────────────────────────

export { compactContentString } from "./context-manager/content-compaction.ts";

// ─── Tool compaction ─────────────────────────────────────────────────────

export { compactToolDefinitions } from "./context-manager/tool-compaction.ts";

// ─── Message trimming ────────────────────────────────────────────────────

export { trimToolMessages, compressThinking } from "./context-manager/message-trimming.ts";

// ─── Message purification ────────────────────────────────────────────────

export { purifyHistory } from "./context-manager/message-purification.ts";

// ─── Semantic extraction ─────────────────────────────────────────────────

export {
  extractTextContent,
  addCompressionSummary,
} from "./context-manager/semantic-extraction.ts";

// ─── Conversation normalization ──────────────────────────────────────────

export { normalizePurifiedMessages } from "./context-manager/conversation-normalizer.ts";

// ─── Compression orchestrator ────────────────────────────────────────────

export { compressContext } from "./context-manager/compression.ts";

// ─── Types ───────────────────────────────────────────────────────────────

export type {
  JsonRecord,
  ContextCompressionLayerStat,
  CompressContextStats,
} from "./context-manager/types.ts";
