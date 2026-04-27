/**
 * Context Manager — Phase 4
 *
 * Pre-flight context compression to prevent "prompt too long" errors.
 * 3 layers: trim tool messages, compress thinking, aggressive purification.
 */

import { REGISTRY } from "../config/registry-providers.ts";
import { getModelContextLimit } from "../../src/lib/modelsDevSync";
import { CONTEXT_CONFIG } from "../../src/shared/constants/context";

type JsonRecord = Record<string, unknown>;

// Default token limits per provider (fallbacks when not in registry)
const DEFAULT_LIMITS: Record<string, number> = {
  claude: 200000,
  openai: 128000,
  gemini: 1000000,
  codex: 400000,
  default: CONTEXT_CONFIG.defaultLimit, // Use unified constant
};

// Environment variable overrides (highest priority)
function getEnvOverride(provider: string): number | null {
  const envKey = `CONTEXT_LENGTH_${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const envValue = process.env[envKey];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  // Global override
  const globalValue = process.env.CONTEXT_LENGTH_DEFAULT;
  if (globalValue) {
    const parsed = parseInt(globalValue, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return null;
}

// Token estimation ratios based on common LLM tokenizers (cl100k_base, p50k_base)
// Different content types have different chars-per-token ratios:
// - Plain English text: ~4 chars/token (natural language is efficient)
// - Code: ~3.0 chars/token (syntax overhead, shorter identifiers)
// - JSON/structured: ~2.8 chars/token (keys, braces, quotes add tokens)
// - Tool schemas: ~2.5 chars/token (heavily structured, many short tokens)
// Conservative defaults target accuracy rather than undercounting.
const CHARS_PER_TOKEN: Record<string, number> = {
  text: 4.0,
  code: 3.0,
  json: 2.8,
  schema: 2.5,
  default: 3.5,
};

// Safety margin multiplier - reduces effective limit to account for:
// - Formatting overhead (roles, timestamps, formatting)
// - Tool/function descriptions
// - System prompt overhead
// - JSON structure overhead
const SAFETY_MARGIN = 0.9; // Use 90% of limit as effective threshold

/** Detect the dominant content type of a string for token estimation. */
function detectContentType(str: string): "text" | "code" | "json" | "schema" {
  if (str.length === 0) return "text";
  const trimmed = str.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      // Distinguish tool schemas from plain JSON
      const obj = JSON.parse(trimmed);
      if (
        typeof obj === "object" &&
        obj !== null &&
        ("type" in obj || "properties" in obj || "parameters" in obj || "function" in obj)
      ) {
        return "schema";
      }
      return "json";
    } catch {
      // Not valid JSON, check for code-like patterns
    }
  }
  // Heuristic for code: frequent symbols, braces, semicolons
  const codeIndicators = (str.match(/[{}();=<>[\]]/g) || []).length;
  if (codeIndicators / str.length > 0.04) return "code";
  return "text";
}

/**
 * Estimate token count from text, optionally using content-type-aware ratios.
 * @param {string|object|null|undefined} text - Text or object to estimate
 * @param {number} [ratio] - Override chars per token ratio (default: auto-detect)
 * @returns {number}
 */
export function estimateTokens(text: string | object | null | undefined, ratio?: number): number {
  if (!text) return 0;
  const str = typeof text === "string" ? text : JSON.stringify(text);
  const effectiveRatio =
    ratio ?? CHARS_PER_TOKEN[detectContentType(str)] ?? CHARS_PER_TOKEN.default;
  return Math.ceil(str.length / effectiveRatio);
}

/**
 * Estimate tokens with explicit content-type detection. Useful for telemetry.
 * Returns both the count and the detected type.
 */
export function estimateTokensDetailed(
  text: string | object | null | undefined,
  ratio?: number
): { tokens: number; contentType: string; ratio: number } {
  if (!text) return { tokens: 0, contentType: "text", ratio: CHARS_PER_TOKEN.text };
  const str = typeof text === "string" ? text : JSON.stringify(text);
  const contentType = detectContentType(str);
  const effectiveRatio = ratio ?? CHARS_PER_TOKEN[contentType] ?? CHARS_PER_TOKEN.default;
  return { tokens: Math.ceil(str.length / effectiveRatio), contentType, ratio: effectiveRatio };
}

/**
 * Calculate effective context limit with safety margin
 * This accounts for formatting overhead that tokenizers include but we can't see
 * @param {number} limit - Original limit from provider/combo
 * @param {number} [margin] - Safety margin (0.9 = 90% of limit)
 * @returns {number}
 */
function getSafeLimit(limit: number, margin: number = SAFETY_MARGIN): number {
  return Math.floor(limit * margin);
}

/**
 * Get token limit for a provider/model combination
 * Priority: Env override > models.dev DB > Registry defaultContextLength > DEFAULT_LIMITS
 */
export function getTokenLimit(provider: string, model: string | null = null): number {
  // 1. Check environment variable override first
  const envOverride = getEnvOverride(provider);
  if (envOverride) return envOverride;

  // 2. Check models.dev synced DB for per-model context limit
  if (model) {
    const dbLimit = getModelContextLimit(provider, model);
    if (dbLimit && dbLimit > 0) return dbLimit;
  }

  // 3. Check if model name hints at a known limit (do this BEFORE provider default)
  if (model) {
    const limit = detectContextLimitFromModelName(model);
    if (limit) return limit;
  }

  // 4. Check registry for provider default
  const registryEntry = REGISTRY[provider];
  if (registryEntry?.defaultContextLength) {
    return registryEntry.defaultContextLength;
  }

  // 5. Fallback to DEFAULT_LIMITS or default
  return DEFAULT_LIMITS[provider] || DEFAULT_LIMITS.default;
}

/**
 * Detect context limit from model name patterns
 * This helps override provider defaults for models with known limits
 *
 * PRIORITY: More specific patterns first, then general patterns
 */
function detectContextLimitFromModelName(model: string): number | null {
  const lower = model.toLowerCase();

  // === HIGH-PRIORITY: Specific model families (checked first) ===

  // Kimi models (128k standard)
  if (lower.includes("kimi")) {
    return 128000;
  }

  // Qwen2.5 series (128k)
  if (lower.includes("qwen2.5")) {
    return 128000;
  }

  // CodeLLaMA (128k context)
  if (lower.includes("codellama")) {
    return 128000;
  }

  // LLaMA 3.1, 3.2, 3.3 (128k)
  if (lower.includes("llama3.1") || lower.includes("llama3.2") || lower.includes("llama3.3")) {
    return 128000;
  }

  // LLaMA 3 (32k) - base version (checked AFTER specific 128k versions)
  if (lower.includes("llama3") && !lower.includes("llama3.")) {
    return 32000;
  }

  // Mistral Large / 8x22B (128k)
  if (lower.includes("mistral") && (lower.includes("large") || lower.includes("8x22b"))) {
    return 128000;
  }

  // Gemma 3 (128k)
  if (lower.includes("gemma3")) {
    return 128000;
  }

  // === 256K MODELS ===
  if (
    lower.includes("qwen3") ||
    lower.includes("qwen2-72b") ||
    lower.includes("deepseek-v3") ||
    lower.includes("llama3.4")
  ) {
    return 256000;
  }

  // === OPENAI MODELS (128k standard) ===
  // These should be checked BEFORE the generic "gpt" pattern
  if (
    lower === "gpt-4" ||
    lower.startsWith("gpt-4-") ||
    lower.startsWith("gpt-4o") ||
    lower.startsWith("gpt-3.5") ||
    lower.includes("gpt-4-turbo") ||
    lower.includes("gpt-4o-mini")
  ) {
    return DEFAULT_LIMITS.openai || 128000;
  }

  // === CLAUDE MODELS (200k) ===
  // Check specific Claude instant first (16k)
  if (lower.includes("claude-instant")) {
    return 16384;
  }
  if (lower.includes("claude")) {
    return DEFAULT_LIMITS.claude;
  }

  // === GEMINI MODELS (1M) ===
  if (lower.includes("gemini")) {
    return DEFAULT_LIMITS.gemini;
  }

  // === CODEX MODELS (400k) ===
  // Must come AFTER specific "gpt-4" check above
  if (
    lower.includes("codex") ||
    lower.includes("o1") ||
    lower.includes("o3") ||
    lower.includes("o4")
  ) {
    return DEFAULT_LIMITS.codex || 400000;
  }

  // Generic "gpt-" fallback (assume 128k for safety)
  if (lower.includes("gpt-")) {
    return DEFAULT_LIMITS.openai || 128000;
  }

  return null;
}

/**
 * Get effective context limit for a request
 * Priority: Env override > MIN(Provider limit, Combo ceiling) > Model-specific > Provider default > Hard-coded
 *
 * Design principle:
 * - Provider limit = maximum tokens that model actually supports (e.g., 128k for OpenAI)
 * - Combo context_length = maximum tokens we're willing to send through this combo (configurable ceiling)
 * - The effective limit = the stricter of the two (smaller value)
 * - Compression triggers when request exceeds effective limit
 *
 * @example
 *   Provider supports 128k, Combo ceiling = 200k → Effective = 128k (use provider limit)
 *   Provider supports 200k, Combo ceiling = 128k → Effective = 128k (use combo ceiling)
 *   Request with 150k tokens + 128k limit → 22k exceeded → compression triggers
 */
export function getEffectiveContextLimit(
  provider: string,
  model: string | null = null,
  combo: Record<string, unknown> | null = null
): number {
  // 1. Check environment variable override first (highest priority for global debug)
  const envOverride = getEnvOverride(provider);
  if (envOverride) return envOverride;

  // 2. Get the actual provider/model limit (the hard constraint)
  const providerLimit = getTokenLimit(provider, model);

  // 3. Combo context_length is a CEILING, not an override
  //    It limits how much we're willing to send, but cannot exceed provider limits
  if (combo && typeof combo.context_length === "number" && combo.context_length > 0) {
    // Return the STRicter of the two:
    // - Provider limit: what the model actually supports
    // - Combo ceiling: what we want to limit for this combo
    return Math.min(providerLimit, combo.context_length);
  }

  // 4. No combo ceiling, just use provider limit
  return providerLimit;
}

/**
 * Estimate total tokens in a request body (messages + system + tools)
 */
export function estimateRequestTokens(body: JsonRecord): number {
  if (!body || typeof body !== "object") return 0;

  let total = 0;

  // Estimate messages
  if (Array.isArray(body.messages)) {
    total += estimateTokens(JSON.stringify(body.messages));
  }

  // Estimate system message — skip if already included inside messages array
  const hasSystemInMessages =
    Array.isArray(body.messages) &&
    (body.messages as JsonRecord[]).some((m) => m.role === "system");
  if (body.system && !hasSystemInMessages) {
    total += estimateTokens(body.system as string | object);
  }

  // Estimate tools
  if (Array.isArray(body.tools)) {
    total += estimateTokens(JSON.stringify(body.tools));
  }

  // Estimate input (for embeddings/other formats)
  if (body.input) {
    total += estimateTokens(body.input as string | object);
  }

  return total;
}

/**
 * Validate if request fits within context limit
 * Uses safety margin to account for formatting overhead (roles, JSON structure, etc.)
 * @returns {{ valid: boolean, estimatedTokens: number, limit: number, exceeded: number, rawLimit: number }}
 */
export function validateContextLimit(
  body: JsonRecord,
  provider: string,
  model: string | null = null,
  combo: Record<string, unknown> | null = null
): { valid: boolean; estimatedTokens: number; limit: number; exceeded: number; rawLimit: number } {
  const estimatedTokens = estimateRequestTokens(body);
  const rawLimit = getEffectiveContextLimit(provider, model, combo);
  // Apply safety margin to account for formatting overhead
  const limit = getSafeLimit(rawLimit);
  const exceeded = Math.max(0, estimatedTokens - limit);

  return {
    valid: estimatedTokens <= limit,
    estimatedTokens,
    limit,
    exceeded,
    rawLimit,
  };
}

export type ContextCompressionLayerStat = {
  name: string;
  tokens: number;
  tokensRemoved?: number;
  details?: Record<string, number | boolean>;
};

/** Token counts and which compression layers ran (empty `layers` when none ran). */
export type CompressContextStats = {
  original: number;
  final: number;
  layers: ContextCompressionLayerStat[];
  droppedMessageCount?: number;
  truncatedToolCount?: number;
  compressedThinkingCount?: number;
  summaryInserted?: boolean;
  systemTruncated?: boolean;
};

/**
 * Apply context compression to request body.
 * Operates in 3 layers of increasing aggressiveness:
 *
 * Layer 1: Trim tool_result messages (truncate long outputs)
 * Layer 2: Compress thinking blocks (remove from history, keep last)
 * Layer 3: Aggressive purification (drop old messages until fitting)
 *
 * @param {object} body - Request body with messages[]
 * @param {object} options - { provider?, model?, maxTokens?, reserveTokens? }
 * @returns {{ body: object, compressed: boolean, stats: object }}
 */
export function compressContext(
  body: JsonRecord,
  options: { provider?: string; model?: string; maxTokens?: number; reserveTokens?: number } = {}
): { body: JsonRecord; compressed: boolean; stats: CompressContextStats } {
  if (!body || !body.messages || !Array.isArray(body.messages)) {
    const t = estimateRequestTokens(body);
    return {
      body,
      compressed: false,
      stats: { original: t, final: t, layers: [] },
    };
  }

  const provider = options.provider || "default";
  const configuredMaxTokens = Number(options.maxTokens);
  const maxTokens =
    Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0
      ? Math.floor(configuredMaxTokens)
      : getTokenLimit(provider, (body.model as string | null | undefined) || options.model);
  const defaultReserveTokens = Math.min(
    CONTEXT_CONFIG.reserveTokens,
    Math.max(256, Math.floor(maxTokens * 0.15))
  );
  const configuredReserveTokens = Number(options.reserveTokens);
  const reserveTokens =
    Number.isFinite(configuredReserveTokens) && configuredReserveTokens >= 0
      ? Math.min(Math.floor(configuredReserveTokens), Math.max(0, maxTokens - 1))
      : defaultReserveTokens;
  const targetTokens = Math.max(0, maxTokens - reserveTokens);

  let messages = [...body.messages];
  let tools = Array.isArray(body.tools) ? [...body.tools] : body.tools;
  const buildWorkingBody = (): JsonRecord => ({ ...body, messages, tools }) as JsonRecord;
  let currentTokens = estimateRequestTokens(buildWorkingBody());
  const stats: Omit<CompressContextStats, "final"> & { final?: number } = {
    original: currentTokens,
    layers: [],
    droppedMessageCount: 0,
    truncatedToolCount: 0,
    compressedThinkingCount: 0,
    summaryInserted: false,
    systemTruncated: false,
  };

  // Already fits
  if (currentTokens <= targetTokens) {
    return {
      body,
      compressed: false,
      stats: { original: currentTokens, final: currentTokens, layers: [] },
    };
  }

  // Layer 0: Compact tool definitions (large tool registries can dominate context budget)
  if (Array.isArray(tools) && tools.length > 0) {
    const tokensBefore = currentTokens;
    tools = compactToolDefinitions(tools, messages, 96, body);
    currentTokens = estimateRequestTokens(buildWorkingBody());
    stats.layers.push({
      name: "compact_tools",
      tokens: currentTokens,
      tokensRemoved: tokensBefore - currentTokens,
    });
    if (currentTokens <= targetTokens) {
      return {
        body: buildWorkingBody(),
        compressed: true,
        stats: { ...stats, final: currentTokens },
      };
    }
  }

  // Layer 1: Trim tool_result/tool messages (signal-aware)
  {
    const tokensBefore = currentTokens;
    const trimResult = trimToolMessages(messages, 2000);
    messages = trimResult.messages;
    stats.truncatedToolCount = trimResult.truncatedCount;
    currentTokens = estimateRequestTokens(buildWorkingBody());
    stats.layers.push({
      name: "trim_tools",
      tokens: currentTokens,
      tokensRemoved: tokensBefore - currentTokens,
      details: { truncatedCount: trimResult.truncatedCount },
    });
    if (currentTokens <= targetTokens) {
      return {
        body: buildWorkingBody(),
        compressed: true,
        stats: { ...stats, final: currentTokens },
      };
    }
  }

  // Layer 2: Compress thinking blocks (remove from non-last assistant messages)
  {
    const tokensBefore = currentTokens;
    let thinkingCount = 0;
    const newMessages = compressThinking(messages);
    // Count how many thinking blocks were removed
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "assistant") {
        const wasThinking = Array.isArray(messages[i].content)
          ? (messages[i].content as JsonRecord[]).filter((b) => b.type === "thinking").length
          : typeof messages[i].content === "string"
            ? ((messages[i].content as string).match(/<thinking>[\s\S]*?<\/thinking>/g) || [])
                .length +
              ((messages[i].content as string).match(/<antThinking>[\s\S]*?<\/antThinking>/g) || [])
                .length
            : 0;
        const isStillThinking = Array.isArray(newMessages[i].content)
          ? (newMessages[i].content as JsonRecord[]).filter((b) => b.type === "thinking").length
          : typeof newMessages[i].content === "string" && i !== newMessages.length - 1
            ? 0
            : Array.isArray(newMessages[i].content)
              ? (newMessages[i].content as JsonRecord[]).filter((b) => b.type === "thinking").length
              : 0;
        thinkingCount += Math.max(0, wasThinking - isStillThinking);
      }
    }
    messages = newMessages;
    stats.compressedThinkingCount = thinkingCount;
    currentTokens = estimateRequestTokens(buildWorkingBody());
    stats.layers.push({
      name: "compress_thinking",
      tokens: currentTokens,
      tokensRemoved: tokensBefore - currentTokens,
      details: { thinkingBlocksRemoved: thinkingCount },
    });
    if (currentTokens <= targetTokens) {
      return {
        body: buildWorkingBody(),
        compressed: true,
        stats: { ...stats, final: currentTokens },
      };
    }
  }

  // Layer 3: Importance-aware purification — drop least important messages until fitting.
  {
    const tokensBefore = currentTokens;
    const purifyResult = purifyHistory(
      messages,
      (candidateMessages) =>
        estimateRequestTokens({ ...body, messages: candidateMessages, tools }) <= targetTokens
    );
    messages = purifyResult.messages;
    stats.droppedMessageCount = purifyResult.droppedCount;
    stats.summaryInserted = purifyResult.droppedCount > 0;
    currentTokens = estimateRequestTokens(buildWorkingBody());
    stats.layers.push({
      name: "purify_history",
      tokens: currentTokens,
      tokensRemoved: tokensBefore - currentTokens,
      details: { droppedMessages: purifyResult.droppedCount },
    });
    if (currentTokens <= targetTokens) {
      return {
        body: buildWorkingBody(),
        compressed: true,
        stats: { ...stats, final: currentTokens },
      };
    }
  }

  // Layer 3.5: Re-attempt tool trimming with more aggressive budget before system truncation
  {
    const tokensBefore = currentTokens;
    const aggressiveTrimResult = trimToolMessages(messages, 500);
    if (aggressiveTrimResult.truncatedCount > 0) {
      messages = aggressiveTrimResult.messages;
      stats.truncatedToolCount += aggressiveTrimResult.truncatedCount;
      currentTokens = estimateRequestTokens(buildWorkingBody());
      if (currentTokens < tokensBefore) {
        stats.layers.push({
          name: "aggressive_trim_tools",
          tokens: currentTokens,
          tokensRemoved: tokensBefore - currentTokens,
          details: { truncatedCount: aggressiveTrimResult.truncatedCount },
        });
        if (currentTokens <= targetTokens) {
          return {
            body: buildWorkingBody(),
            compressed: true,
            stats: { ...stats, final: currentTokens },
          };
        }
      }
    }
  }

  // Layer 4: System prompt truncation (Nuclear — Last Resort)
  // Only after all other layers have been exhausted.
  let finalBody = buildWorkingBody();
  if (finalBody.system) {
    const tokensBefore = currentTokens;
    const excessTokens = currentTokens - targetTokens;
    // Estimate chars to drop based on the type of content in the system prompt
    const systemStr =
      typeof finalBody.system === "string" ? finalBody.system : JSON.stringify(finalBody.system);
    const sysRatio = CHARS_PER_TOKEN[detectContentType(systemStr)] || CHARS_PER_TOKEN.default;
    const charsToDrop = Math.ceil(excessTokens * sysRatio);

    if (typeof finalBody.system === "string") {
      // Preserve instruction-critical prefix (first 30% or at least 200 chars)
      const preservedChars = Math.max(200, Math.ceil(finalBody.system.length * 0.3));
      if (finalBody.system.length > charsToDrop + preservedChars) {
        // Truncate from the tail, preserving the prefix
        const truncationPoint = finalBody.system.length - charsToDrop;
        finalBody.system =
          finalBody.system.slice(0, truncationPoint) +
          "\n\n[... system prompt truncated to fit context limit — critical instructions preserved above ...]";
      } else if (finalBody.system.length > 100) {
        // Even truncating everything beyond prefix won't fit; keep only prefix
        finalBody.system =
          finalBody.system.slice(0, preservedChars) +
          "\n\n[... system prompt heavily truncated — some instructions may be lost ...]";
      } else {
        finalBody.system = "[system prompt truncated to fit context limit]";
      }
    } else if (Array.isArray(finalBody.system)) {
      // For array system prompts, truncate text blocks from the tail
      const blocks = [...(finalBody.system as JsonRecord[])];
      let remaining = charsToDrop;
      // Traverse from back to front, truncating text blocks
      for (let i = blocks.length - 1; i >= 0 && remaining > 0; i--) {
        if (blocks[i].type === "text" && typeof blocks[i].text === "string") {
          const preservedChars = Math.max(100, Math.ceil((blocks[i].text as string).length * 0.2));
          if ((blocks[i].text as string).length > remaining + preservedChars) {
            blocks[i] = {
              ...blocks[i],
              text:
                (blocks[i].text as string).slice(0, (blocks[i].text as string).length - remaining) +
                "\n[... truncated]",
            };
            remaining = 0;
          } else if ((blocks[i].text as string).length > remaining) {
            blocks[i] = {
              ...blocks[i],
              text: (blocks[i].text as string).slice(0, preservedChars) + "\n[... truncated]",
            };
            remaining -= (blocks[i].text as string).length - preservedChars;
          } else {
            blocks[i] = { ...blocks[i], text: "[truncated]" };
            remaining -= (blocks[i].text as string).length;
          }
        }
      }
      finalBody.system = blocks;
    }

    stats.systemTruncated = true;
    currentTokens = estimateRequestTokens(finalBody);
    stats.layers.push({
      name: "truncate_system",
      tokens: currentTokens,
      tokensRemoved: tokensBefore - currentTokens,
    });
  }

  return {
    body: finalBody,
    compressed: true,
    stats: { ...stats, final: currentTokens },
  };
}

function compactToolDefinitions(
  tools: JsonRecord[],
  messages: JsonRecord[],
  maxTools: number = 48,
  body?: JsonRecord
): JsonRecord[] {
  const normalizeToolNameKey = (name: string): string => name.trim().toLowerCase();
  const getToolName = (tool: JsonRecord): string => {
    const candidate =
      (tool as { function?: { name?: string }; name?: string })?.function?.name ||
      (tool as { name?: string })?.name ||
      "";
    return typeof candidate === "string" ? candidate : "";
  };
  const isCriticalRuntimeTool = (name: string): boolean => {
    const normalized = normalizeToolNameKey(name);
    if (!normalized) return false;
    return (
      normalized.startsWith("skills_") ||
      normalized.startsWith("memory_") ||
      normalized === "skills_execute" ||
      normalized === "skills_list" ||
      normalized === "skills_enable" ||
      normalized === "skills_executions"
    );
  };

  const requiredToolNames = new Set<string>();
  const rawToolChoice = body?.tool_choice;
  if (rawToolChoice && typeof rawToolChoice === "object" && !Array.isArray(rawToolChoice)) {
    const toolChoice = rawToolChoice as { type?: string; function?: { name?: string } };
    if (
      toolChoice.type === "function" &&
      typeof toolChoice.function?.name === "string" &&
      toolChoice.function.name.trim()
    ) {
      requiredToolNames.add(normalizeToolNameKey(toolChoice.function.name));
    }
  }

  const preferredToolNames = new Set([
    "read",
    "update",
    "edit",
    "multiedit",
    "write",
    "bash",
    "glob",
    "grep",
    "todowrite",
    "task",
    "skill",
    "apply_patch",
    "question",
    "playwright_browser_navigate",
    "playwright_browser_snapshot",
    "playwright_browser_click",
    "playwright_browser_type",
    "filesystem_read_text_file",
    "filesystem_list_directory",
    "filesystem_search_files",
  ]);

  const calledToolNames = new Set<string>();
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls as Array<{ function?: { name?: string }; name?: string }>) {
        const name = tc?.function?.name || tc?.name;
        if (typeof name === "string" && name.trim()) {
          calledToolNames.add(normalizeToolNameKey(name));
        }
      }
    }

    if (Array.isArray(msg.content)) {
      for (const block of msg.content as Array<{ type?: string; name?: string }>) {
        if (
          (block?.type === "tool_use" || block?.type === "server_tool_use") &&
          typeof block.name === "string" &&
          block.name.trim()
        ) {
          calledToolNames.add(normalizeToolNameKey(block.name));
        }
      }
    }
  }

  const ordered = [...tools].sort((a, b) => {
    const aName = getToolName(a);
    const bName = getToolName(b);
    const aKey = normalizeToolNameKey(aName);
    const bKey = normalizeToolNameKey(bName);

    const aRequired = requiredToolNames.has(aKey) ? 1 : 0;
    const bRequired = requiredToolNames.has(bKey) ? 1 : 0;
    if (aRequired !== bRequired) return bRequired - aRequired;

    const aCritical = isCriticalRuntimeTool(String(aName)) ? 1 : 0;
    const bCritical = isCriticalRuntimeTool(String(bName)) ? 1 : 0;
    if (aCritical !== bCritical) return bCritical - aCritical;

    const aUsed = calledToolNames.has(aKey) ? 1 : 0;
    const bUsed = calledToolNames.has(bKey) ? 1 : 0;
    if (aUsed !== bUsed) return bUsed - aUsed;
    const aPreferred = preferredToolNames.has(aKey) ? 1 : 0;
    const bPreferred = preferredToolNames.has(bKey) ? 1 : 0;
    return bPreferred - aPreferred;
  });

  const selected = ordered.slice(0, maxTools);

  const criticalNames = new Set(
    ordered
      .map((tool) => getToolName(tool))
      .filter((name) => typeof name === "string" && isCriticalRuntimeTool(name))
  );

  if (criticalNames.size > 0) {
    const selectedNames = new Set(selected.map((tool) => normalizeToolNameKey(getToolName(tool))));
    for (const criticalName of criticalNames) {
      const criticalKey = normalizeToolNameKey(criticalName);
      if (selectedNames.has(criticalKey)) continue;
      const criticalTool = ordered.find((tool) => getToolName(tool) === criticalName);
      if (!criticalTool) continue;
      if (selected.length >= maxTools && maxTools > 0) selected.pop();
      selected.unshift(criticalTool);
      selectedNames.add(criticalKey);
    }
  }

  if (requiredToolNames.size > 0) {
    const selectedNames = new Set(selected.map((tool) => normalizeToolNameKey(getToolName(tool))));

    for (const requiredName of requiredToolNames) {
      if (selectedNames.has(requiredName)) continue;
      const requiredTool = ordered.find((tool) => {
        const name = getToolName(tool);
        return normalizeToolNameKey(name) === requiredName;
      });
      if (!requiredTool) continue;
      if (selected.length >= maxTools && maxTools > 0) selected.pop();
      selected.unshift(requiredTool);
      selectedNames.add(requiredName);
    }
  }

  // Variable description budgets based on tool priority:
  // - Required tool choice: full description preserved (up to 500 chars)
  // - Previously used tools: 400 char budget
  // - Preferred/common tools: 250 char budget
  // - Unused/other tools: 120 char budget
  const getDescriptionBudget = (tool: JsonRecord): number => {
    const name = getToolName(tool);
    const key = normalizeToolNameKey(name);
    if (requiredToolNames.has(key)) return 500;
    if (calledToolNames.has(key)) return 400;
    if (preferredToolNames.has(key)) return 250;
    return 120;
  };

  return selected.map((tool) => {
    const next = { ...tool };
    if (next.function && typeof next.function === "object") {
      const fn = { ...(next.function as Record<string, unknown>) };
      const budget = getDescriptionBudget(tool);
      if (typeof fn.description === "string" && fn.description.length > budget) {
        fn.description = `${fn.description.slice(0, budget)}...`;
      }
      next.function = fn;
    }
    return next;
  });
}

// ─── Signal-Aware Text Compaction Helpers ───────────────────────────────────

const ERROR_PATTERNS = [
  /\berror\b/i,
  /\bexception\b/i,
  /\bfail(ed|ure)?\b/i,
  /\btraceback\b/i,
  /\bstack\s*trace\b/i,
  /\bfatal\b/i,
  /\bwarning\b/i,
  /\bwarn\b/i,
  /\bpanic\b/i,
  /\bnot\s+found\b/i,
  /\bdenied\b/i,
  /\bforbidden\b/i,
  /\bunauthorized\b/i,
  /\btimeout\b/i,
  /\babort(ed)?\b/i,
];

/** Extract signal-bearing lines (errors, warnings, stack traces) from text. */
function extractSignalLines(text: string, maxLines: number = 50): string[] {
  const lines = text.split("\n");
  const signalLines: string[] = [];
  for (const line of lines) {
    if (signalLines.length >= maxLines) break;
    if (ERROR_PATTERNS.some((p) => p.test(line))) {
      signalLines.push(line);
    }
  }
  return signalLines;
}

/** Compact a text string preserving head + tail with a gap indicator. */
function _compactTextOutput(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const headBudget = Math.ceil(maxChars * 0.6);
  const tailBudget = maxChars - headBudget - 30; // 30 chars for gap marker
  const head = text.slice(0, headBudget);
  const tail = text.slice(text.length - tailBudget);
  return head + "\n... [truncated, signal lines preserved] ...\n" + tail;
}

/** Compact a JSON string preserving its shape and key fields. */
function compactJsonOutput(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  try {
    const obj = JSON.parse(text);
    const compacted = JSON.stringify(obj, (key, value) => {
      if (typeof value === "string" && value.length > 200) {
        return value.slice(0, 200) + "... [truncated]";
      }
      return value;
    });
    if (compacted.length <= maxChars) return compacted;
  } catch {
    // Not valid JSON, fall through to text compaction
  }
  // Try signal-aware text compaction as fallback
  return compactTextWithSignals(text, maxChars);
}

/** Compact text preserving signal lines (errors, warnings) + head/tail. */
function compactTextWithSignals(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const signals = extractSignalLines(text, 40);
  if (signals.length > 3) {
    // Worth extracting signals separately
    const signalBlock = signals.join("\n");
    const remainingBudget = maxChars - signalBlock.length - 60;
    if (remainingBudget > 200) {
      const head = text.slice(0, Math.ceil(remainingBudget * 0.6));
      const tail = text.slice(text.length - Math.floor(remainingBudget * 0.4));
      return (
        head +
        "\n\n... [truncated] Key signal lines:\n" +
        signalBlock +
        "\n\n... [truncated] ...\n" +
        tail
      );
    }
  }

  // Standard head+tail compaction with signal awareness
  const signalHead = extractSignalLines(text.slice(0, Math.ceil(maxChars * 0.3)), 10);
  const headBudget = Math.ceil(maxChars * 0.55);
  const tailBudget = maxChars - headBudget - 30;
  const head = text.slice(0, headBudget);
  const tail = text.slice(text.length - tailBudget);
  let result = head + "\n... [truncated] ...\n" + tail;
  if (signalHead.length > 0 && !result.includes(signalHead[0])) {
    const signalPrefix = signalHead.slice(0, 5).join("\n");
    result = signalPrefix + "\n... [signal lines] ...\n" + result;
  }
  return result;
}

/** Signal-aware compaction for a single content string. */
function compactContentString(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  const trimmed = content.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return compactJsonOutput(content, maxChars);
  }
  return compactTextWithSignals(content, maxChars);
}

// ─── Layer 1: Trim Tool Messages (Signal-Aware) ───────────────────────────

function trimToolMessages(
  messages: JsonRecord[],
  maxChars: number
): { messages: JsonRecord[]; truncatedCount: number } {
  let truncatedCount = 0;
  const result = messages.map((msg) => {
    if (msg.role === "tool") {
      if (typeof msg.content === "string" && msg.content.length > maxChars) {
        truncatedCount++;
        return {
          ...msg,
          content: compactContentString(msg.content, maxChars),
        };
      }
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: (msg.content as JsonRecord[]).map((block) => {
            if (
              block.type === "text" &&
              typeof block.text === "string" &&
              block.text.length > maxChars
            ) {
              truncatedCount++;
              return { ...block, text: compactContentString(block.text, maxChars) };
            }
            return block;
          }),
        };
      }
    }
    // Handle array content (Claude format with tool_result blocks)
    if (msg.role === "user" && Array.isArray(msg.content)) {
      return {
        ...msg,
        content: (msg.content as JsonRecord[]).map((block) => {
          if (block.type === "tool_result") {
            if (typeof block.content === "string" && block.content.length > maxChars) {
              truncatedCount++;
              return { ...block, content: compactContentString(block.content, maxChars) };
            } else if (Array.isArray(block.content)) {
              let subTruncated = 0;
              const newContent = (block.content as JsonRecord[]).map((subBlock) => {
                if (
                  subBlock.type === "text" &&
                  typeof subBlock.text === "string" &&
                  subBlock.text.length > maxChars
                ) {
                  subTruncated++;
                  return {
                    ...subBlock,
                    text: compactContentString(subBlock.text, maxChars),
                  };
                }
                return subBlock;
              });
              truncatedCount += subTruncated;
              return { ...block, content: newContent };
            }
          }
          return block;
        }),
      };
    }
    return msg;
  });
  return { messages: result, truncatedCount };
}

// ─── Layer 2: Compress Thinking Blocks ──────────────────────────────────────

function compressThinking(messages: JsonRecord[]): JsonRecord[] {
  // Find last assistant message index
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantIdx = i;
      break;
    }
  }

  return messages.map((msg, i) => {
    if (msg.role !== "assistant") return msg;
    if (i === lastAssistantIdx) return msg; // Keep thinking in last assistant msg

    // Remove thinking blocks from content array
    if (Array.isArray(msg.content)) {
      const filtered = (msg.content as JsonRecord[]).filter((block) => block.type !== "thinking");
      if (filtered.length === 0) {
        return { ...msg, content: [{ type: "text", text: "[thinking compressed]" }] };
      }
      return { ...msg, content: filtered };
    }

    // Remove thinking XML tags from string content
    if (typeof msg.content === "string") {
      const cleaned = msg.content
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
        .replace(/<antThinking>[\s\S]*?<\/antThinking>/g, "")
        .trim();
      return { ...msg, content: cleaned || "[thinking compressed]" };
    }

    return msg;
  });
}

// ─── Layer 3: Importance-Aware Purification ──────────────────────────────────

/** Score a message's importance for preservation during compression. Higher = more important. */
function scoreMessageImportance(msg: JsonRecord, index: number, total: number): number {
  let score = 0;
  const content = extractTextContent(msg);
  const role = typeof msg.role === "string" ? msg.role : "";

  // Recency bonus: later messages are more important
  score += (index / total) * 40;

  // Role-based scoring
  if (role === "system" || role === "developer") {
    score += 100; // System messages are always preserved separately
  } else if (role === "user") {
    // Latest user message is extremely important
    if (index === total - 1 || (index === total - 2 && total - 1 >= 0)) {
      score += 80;
    } else {
      score += 30;
    }
    // User messages containing constraints are more important
    if (content && CONSTRAINT_PATTERNS.some((p) => p.test(content))) {
      score += 25;
    }
  } else if (role === "assistant") {
    // Latest assistant response is very important
    score += 20;
    // Assistant decisions are important
    if (content && DECISION_PATTERNS.some((p) => p.test(content))) {
      score += 15;
    }
  } else if (role === "tool") {
    // Tool results with errors are important
    if (content && ERROR_PATTERNS_ANCHOR.some((p) => p.test(content))) {
      score += 35;
    } else {
      score += 5;
    }
  }

  // Messages with tool_calls are important (they hold the interaction chain)
  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    score += 20;
  }
  // Assistant messages with tool_use content blocks
  if (Array.isArray(msg.content)) {
    const hasToolUse = (msg.content as JsonRecord[]).some(
      (b) => b.type === "tool_use" || b.type === "server_tool_use"
    );
    if (hasToolUse) score += 20;
  }

  return score;
}

function purifyHistory(
  messages: JsonRecord[],
  fitsWithinTarget: (msgs: JsonRecord[]) => boolean
): { messages: JsonRecord[]; droppedCount: number } {
  // Keep system message(s) and the most important non-system messages that still fit.
  const system = messages.filter((m) => m.role === "system" || m.role === "developer");
  const nonSystem = messages.filter((m) => m.role !== "system" && m.role !== "developer");

  if (nonSystem.length === 0) {
    return { messages: [...system], droppedCount: 0 };
  }

  const buildCandidate = (
    keepCount: number,
    includeSummary: boolean,
    droppedSlice: JsonRecord[]
  ): JsonRecord[] => {
    let keptMessages: JsonRecord[] = [];
    if (keepCount > 0) {
      // Use importance-aware selection: always anchor from newest, then pick important older messages
      keptMessages = selectImportantMessages(nonSystem, keepCount);
    }
    const candidate =
      includeSummary && keepCount < nonSystem.length
        ? addCompressionSummary(system, keptMessages, droppedSlice)
        : [...system, ...keptMessages];
    return normalizePurifiedMessages(candidate);
  };

  let keep = nonSystem.length;
  while (keep >= 0) {
    const droppedSlice = keep < nonSystem.length ? nonSystem.slice(0, nonSystem.length - keep) : [];
    const withSummary = buildCandidate(keep, true, droppedSlice);
    if (fitsWithinTarget(withSummary)) {
      return { messages: withSummary, droppedCount: nonSystem.length - keep };
    }

    const withoutSummary = buildCandidate(keep, false, []);
    if (fitsWithinTarget(withoutSummary)) {
      return { messages: withoutSummary, droppedCount: nonSystem.length - keep };
    }

    if (keep === 0) break;
    // Gentler decay than 0.7 (which nuked ~30% per step and felt like "half context gone")
    const nextKeep = Math.max(0, Math.floor(keep * 0.9));
    keep = nextKeep < keep ? nextKeep : keep - 1;
  }

  return { messages: buildCandidate(0, false, []), droppedCount: nonSystem.length };
}

/** Select the most important messages, preserving conversation coherence. */
function findLastUserIndex(messages: JsonRecord[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return i;
  }
  return -1;
}

function selectImportantMessages(messages: JsonRecord[], count: number): JsonRecord[] {
  if (count >= messages.length) return [...messages];
  if (count <= 0) return [];

  const total = messages.length;

  // Always include the last user message (most recent request)
  // Then fill with most important messages using scoring
  const scored = messages.map((msg, i) => ({
    msg,
    index: i,
    score: scoreMessageImportance(msg, i, total),
  }));

  // Sort by score descending, but always ensure the last user message is included
  const lastUserIdx = findLastUserIndex(messages);
  const mustInclude = new Set<number>();
  if (lastUserIdx >= 0) mustInclude.add(lastUserIdx);

  // Also include messages in the immediate tail that form a coherent conversation
  // (the last few messages are almost always important)
  const tailSize = Math.min(3, count);
  for (let i = total - tailSize; i < total; i++) {
    if (i >= 0) mustInclude.add(i);
  }

  // Fill remaining slots by score
  const remaining = count - mustInclude.size;
  const candidates = scored
    .filter((s) => !mustInclude.has(s.index))
    .sort((a, b) => b.score - a.score)
    .slice(0, remaining);

  const selected = new Set<number>(Array.from(mustInclude).concat(candidates.map((c) => c.index)));

  // Return messages in original order for coherence, then rebuild conversation anchors
  const result = messages.filter((_, i) => selected.has(i));

  // Ensure the result starts with a user message (conversation anchoring)
  const firstUserIdx = result.findIndex((m) => m.role === "user");
  if (firstUserIdx > 0) {
    return result.slice(firstUserIdx);
  }

  return result;
}

/** Patterns for extracting semantic anchors from dropped messages. */
const CONSTRAINT_PATTERNS = [
  /\b(must|shall|always|never|do\s+not|don'?t|required?|mandatory|essential|critical|important|vital|strictly)\b/i,
  /\b(constraint|requirement|prerequisite|condition|limitation|restriction|boundary|deadline)\b/i,
];
const DECISION_PATTERNS = [
  /\b(decided|decision|chose|chosen|going\s+to|will\s+use|we'?ll|plan\s+is|strategy|approach)\b/i,
];
const ERROR_PATTERNS_ANCHOR = [
  /\berror\b/i,
  /\bexception\b/i,
  /\bfail(ed|ure)?\b/i,
  /\btraceback\b/i,
  /\bblocked\b/i,
];
const QUESTION_PATTERN = /\?/;

/** Extract plain text from a message regardless of content format. */
function extractTextContent(msg: JsonRecord): string | null {
  if (!msg || typeof msg !== "object") return null;
  const content = msg.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as JsonRecord[])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");
  }
  return null;
}

/** Extract semantic anchors from messages being dropped by compression. */
function extractAnchors(droppedMessages: JsonRecord[]): {
  goal: string | null;
  constraints: string[];
  decisions: string[];
  errors: string[];
  openIssues: string[];
} {
  let goal: string | null = null;
  const constraints: string[] = [];
  const decisions: string[] = [];
  const errors: string[] = [];
  const openIssues: string[] = [];
  const MAX_PER_CATEGORY = 3;
  const MAX_LINE_LENGTH = 120;

  const truncate = (s: string): string =>
    s.length > MAX_LINE_LENGTH ? s.slice(0, MAX_LINE_LENGTH) + "..." : s;

  for (const msg of droppedMessages) {
    const content = extractTextContent(msg);
    if (!content) continue;

    // Extract goal from first user message
    if (!goal && msg.role === "user") {
      goal = truncate(content.split("\n")[0]);
    }

    // Extract constraints from user or system messages
    if ((msg.role === "user" || msg.role === "system") && constraints.length < MAX_PER_CATEGORY) {
      for (const line of content.split("\n")) {
        if (CONSTRAINT_PATTERNS.some((p) => p.test(line))) {
          constraints.push(truncate(line.trim()));
          if (constraints.length >= MAX_PER_CATEGORY) break;
        }
      }
    }

    // Extract decisions from assistant messages
    if (msg.role === "assistant" && decisions.length < MAX_PER_CATEGORY) {
      for (const line of content.split("\n")) {
        if (DECISION_PATTERNS.some((p) => p.test(line))) {
          decisions.push(truncate(line.trim()));
          if (decisions.length >= MAX_PER_CATEGORY) break;
        }
      }
    }

    // Extract errors from tool results and assistant messages
    if ((msg.role === "tool" || msg.role === "assistant") && errors.length < MAX_PER_CATEGORY) {
      for (const line of content.split("\n")) {
        if (ERROR_PATTERNS_ANCHOR.some((p) => p.test(line))) {
          errors.push(truncate(line.trim()));
          if (errors.length >= MAX_PER_CATEGORY) break;
        }
      }
    }

    // Extract open issues (questions in user messages)
    if (msg.role === "user" && openIssues.length < MAX_PER_CATEGORY) {
      for (const line of content.split("\n")) {
        if (QUESTION_PATTERN.test(line) && line.trim().length > 10) {
          openIssues.push(truncate(line.trim()));
          if (openIssues.length >= MAX_PER_CATEGORY) break;
        }
      }
    }
  }

  return { goal, constraints, decisions, errors, openIssues };
}

/** Build a structured compression summary from extracted anchors. */
function buildStructuredSummary(droppedMessages: JsonRecord[], droppedCount: number): string {
  const anchors = extractAnchors(droppedMessages);
  const parts: string[] = [
    `[Context compressed: ${droppedCount} earlier messages removed to fit context window]`,
  ];

  if (anchors.goal) {
    parts.push(`Goal: ${anchors.goal}`);
  }
  if (anchors.constraints.length > 0) {
    parts.push(`Constraints: ${anchors.constraints.join("; ")}`);
  }
  if (anchors.decisions.length > 0) {
    parts.push(`Decisions: ${anchors.decisions.join("; ")}`);
  }
  if (anchors.errors.length > 0) {
    parts.push(`Prior errors: ${anchors.errors.join("; ")}`);
  }
  if (anchors.openIssues.length > 0) {
    parts.push(`Open issues: ${anchors.openIssues.join("; ")}`);
  }

  return parts.join("\n");
}

function addCompressionSummary(
  system: JsonRecord[],
  keptMessages: JsonRecord[],
  droppedMessages: JsonRecord[]
): JsonRecord[] {
  const summary = buildStructuredSummary(droppedMessages, droppedMessages.length);
  const candidate = [...system, ...keptMessages];
  const firstConversationIdx = candidate.findIndex(
    (msg) => msg.role !== "system" && msg.role !== "developer"
  );

  if (firstConversationIdx === -1) {
    return [...system, { role: "user", content: summary }];
  }

  const firstMessage = candidate[firstConversationIdx];
  if (firstMessage.role === "user") {
    if (typeof firstMessage.content === "string") {
      candidate[firstConversationIdx] = {
        ...firstMessage,
        content: `${summary}\n\n${firstMessage.content}`,
      };
      return candidate;
    }

    if (Array.isArray(firstMessage.content)) {
      candidate[firstConversationIdx] = {
        ...firstMessage,
        content: [{ type: "text", text: summary }, ...(firstMessage.content as JsonRecord[])],
      };
      return candidate;
    }
  }

  candidate.splice(firstConversationIdx, 0, { role: "user", content: summary });
  return candidate;
}

function normalizePurifiedMessages(messages: JsonRecord[]): JsonRecord[] {
  const systemPrefix = messages.filter((m) => m.role === "system" || m.role === "developer");
  const conversation = messages.filter((m) => m.role !== "system" && m.role !== "developer");

  let start = 0;
  while (start < conversation.length && conversation[start].role !== "user") {
    start += 1;
  }
  const anchoredConversation = conversation.slice(start);

  const seenToolUseIds = new Set<string>();
  const normalizedConversation: JsonRecord[] = [];

  for (const msg of anchoredConversation) {
    if (!msg || typeof msg !== "object") continue;
    const role = typeof msg.role === "string" ? msg.role : "";

    if (role === "assistant") {
      if (Array.isArray(msg.tool_calls)) {
        for (const toolCall of msg.tool_calls as Array<{ id?: string }>) {
          if (typeof toolCall?.id === "string" && toolCall.id.trim()) {
            seenToolUseIds.add(toolCall.id.trim());
          }
        }
      }

      if (Array.isArray(msg.content)) {
        for (const block of msg.content as JsonRecord[]) {
          if (
            block?.type === "tool_use" &&
            typeof block.id === "string" &&
            String(block.id).trim()
          ) {
            seenToolUseIds.add(String(block.id).trim());
          }
        }
      }

      normalizedConversation.push(msg);
      continue;
    }

    if (role === "tool") {
      const toolCallId = typeof msg.tool_call_id === "string" ? msg.tool_call_id.trim() : "";
      if (toolCallId && seenToolUseIds.has(toolCallId)) {
        normalizedConversation.push(msg);
      }
      continue;
    }

    if (role === "user" && Array.isArray(msg.content)) {
      const filteredContent = (msg.content as JsonRecord[]).filter((block) => {
        if (block?.type !== "tool_result") return true;
        const toolUseId =
          typeof block.tool_use_id === "string" ? String(block.tool_use_id).trim() : "";
        return !toolUseId || seenToolUseIds.has(toolUseId);
      });

      if (filteredContent.length === 0) continue;
      normalizedConversation.push({ ...msg, content: filteredContent });
      continue;
    }

    normalizedConversation.push(msg);
  }

  return [...systemPrefix, ...normalizedConversation];
}
