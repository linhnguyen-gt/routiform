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
// English text: ~4 chars/token, code: ~3-3.5 chars/token
// Using conservative estimate to be safe (3.5 chars/token average)
const CHARS_PER_TOKEN_AVG = 3.5;

// Safety margin multiplier - reduces effective limit to account for:
// - Formatting overhead (roles, timestamps, formatting)
// - Tool/function descriptions
// - System prompt overhead
// - JSON structure overhead
const SAFETY_MARGIN = 0.9; // Use 90% of limit as effective threshold

/**
 * Estimate token count from text length using provider-specific ratios
 * @param {string|object} text - Text or object to estimate
 * @param {number} [ratio] - Chars per token ratio (default: 3.5)
 * @returns {number}
 */
export function estimateTokens(
  text: string | object | null | undefined,
  ratio: number = CHARS_PER_TOKEN_AVG
): number {
  if (!text) return 0;
  const str = typeof text === "string" ? text : JSON.stringify(text);
  return Math.ceil(str.length / ratio);
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
};

/** Token counts and which compression layers ran (empty `layers` when none ran). */
export type CompressContextStats = {
  original: number;
  final: number;
  layers: ContextCompressionLayerStat[];
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
  const stats: { original: number; layers: ContextCompressionLayerStat[] } = {
    original: currentTokens,
    layers: [],
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
    tools = compactToolDefinitions(tools, messages, 96, body);
    currentTokens = estimateRequestTokens(buildWorkingBody());
    stats.layers.push({ name: "compact_tools", tokens: currentTokens });
    if (currentTokens <= targetTokens) {
      return {
        body: buildWorkingBody(),
        compressed: true,
        stats: { ...stats, final: currentTokens },
      };
    }
  }

  // Layer 1: Trim tool_result/tool messages
  messages = trimToolMessages(messages, 2000); // Max 2000 chars per tool result
  currentTokens = estimateRequestTokens(buildWorkingBody());
  stats.layers.push({ name: "trim_tools", tokens: currentTokens });

  if (currentTokens <= targetTokens) {
    return {
      body: buildWorkingBody(),
      compressed: true,
      stats: { ...stats, final: currentTokens },
    };
  }

  // Layer 2: Compress thinking blocks (remove from non-last assistant messages)
  messages = compressThinking(messages);
  currentTokens = estimateRequestTokens(buildWorkingBody());
  stats.layers.push({ name: "compress_thinking", tokens: currentTokens });

  if (currentTokens <= targetTokens) {
    return {
      body: buildWorkingBody(),
      compressed: true,
      stats: { ...stats, final: currentTokens },
    };
  }

  // Layer 3: Aggressive purification — drop oldest messages keeping the newest content that still fits.
  messages = purifyHistory(
    messages,
    (candidateMessages) =>
      estimateRequestTokens({ ...body, messages: candidateMessages, tools }) <= targetTokens
  );
  currentTokens = estimateRequestTokens(buildWorkingBody());
  stats.layers.push({ name: "purify_history", tokens: currentTokens });

  if (currentTokens <= targetTokens) {
    return {
      body: buildWorkingBody(),
      compressed: true,
      stats: { ...stats, final: currentTokens },
    };
  }

  // Layer 4: System prompt truncation (Final Resort)
  // If we are STILL over the limit, it means the system prompt itself is too large.
  let finalBody = buildWorkingBody();
  if (finalBody.system) {
    const excessTokens = currentTokens - targetTokens;
    const charsToDrop = excessTokens * 4; // Rough approximation
    if (typeof finalBody.system === "string") {
      if (finalBody.system.length > charsToDrop + 100) {
        finalBody.system =
          finalBody.system.slice(0, finalBody.system.length - charsToDrop) +
          "\n... [system prompt truncated to fit context limit]";
      } else {
        finalBody.system = "[system prompt truncated to fit context limit]";
      }
    } else if (Array.isArray(finalBody.system)) {
      finalBody.system = finalBody.system.map((block) => {
        if (block.type === "text" && typeof block.text === "string") {
          if (block.text.length > charsToDrop + 100) {
            return {
              ...block,
              text:
                block.text.slice(0, block.text.length - charsToDrop) +
                "\n... [system prompt truncated]",
            };
          }
        }
        return block;
      });
    }
  }

  currentTokens = estimateRequestTokens(finalBody);
  stats.layers.push({ name: "truncate_system", tokens: currentTokens });

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
  const requiredToolNames = new Set<string>();
  const rawToolChoice = body?.tool_choice;
  if (rawToolChoice && typeof rawToolChoice === "object" && !Array.isArray(rawToolChoice)) {
    const toolChoice = rawToolChoice as { type?: string; function?: { name?: string } };
    if (
      toolChoice.type === "function" &&
      typeof toolChoice.function?.name === "string" &&
      toolChoice.function.name.trim()
    ) {
      requiredToolNames.add(toolChoice.function.name.trim());
    }
  }

  const preferredToolNames = new Set([
    "read",
    "glob",
    "grep",
    "bash",
    "write",
    "edit",
    "apply_patch",
    "question",
    "task",
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
    if (!Array.isArray(msg.tool_calls)) continue;
    for (const tc of msg.tool_calls as Array<{ function?: { name?: string }; name?: string }>) {
      const name = tc?.function?.name || tc?.name;
      if (typeof name === "string" && name.trim()) {
        calledToolNames.add(name.trim());
      }
    }
  }

  const ordered = [...tools].sort((a, b) => {
    const aName =
      (a as { function?: { name?: string }; name?: string })?.function?.name ||
      (a as { name?: string })?.name ||
      "";
    const bName =
      (b as { function?: { name?: string }; name?: string })?.function?.name ||
      (b as { name?: string })?.name ||
      "";

    const aRequired = requiredToolNames.has(String(aName)) ? 1 : 0;
    const bRequired = requiredToolNames.has(String(bName)) ? 1 : 0;
    if (aRequired !== bRequired) return bRequired - aRequired;

    const aUsed = calledToolNames.has(String(aName)) ? 1 : 0;
    const bUsed = calledToolNames.has(String(bName)) ? 1 : 0;
    if (aUsed !== bUsed) return bUsed - aUsed;
    const aPreferred = preferredToolNames.has(String(aName)) ? 1 : 0;
    const bPreferred = preferredToolNames.has(String(bName)) ? 1 : 0;
    return bPreferred - aPreferred;
  });

  const selected = ordered.slice(0, maxTools);
  if (requiredToolNames.size > 0) {
    const selectedNames = new Set(
      selected.map(
        (tool) =>
          (tool as { function?: { name?: string }; name?: string })?.function?.name ||
          (tool as { name?: string })?.name ||
          ""
      )
    );

    for (const requiredName of requiredToolNames) {
      if (selectedNames.has(requiredName)) continue;
      const requiredTool = ordered.find((tool) => {
        const name =
          (tool as { function?: { name?: string }; name?: string })?.function?.name ||
          (tool as { name?: string })?.name ||
          "";
        return name === requiredName;
      });
      if (!requiredTool) continue;
      if (selected.length >= maxTools && maxTools > 0) selected.pop();
      selected.unshift(requiredTool);
      selectedNames.add(requiredName);
    }
  }

  return selected.map((tool) => {
    const next = { ...tool };
    if (next.function && typeof next.function === "object") {
      const fn = { ...(next.function as Record<string, unknown>) };
      if (typeof fn.description === "string" && fn.description.length > 300) {
        fn.description = `${fn.description.slice(0, 300)}...`;
      }
      next.function = fn;
    }
    return next;
  });
}

// ─── Layer 1: Trim Tool Messages ────────────────────────────────────────────

function trimToolMessages(messages: JsonRecord[], maxChars: number): JsonRecord[] {
  return messages.map((msg) => {
    if (msg.role === "tool") {
      if (typeof msg.content === "string" && msg.content.length > maxChars) {
        return {
          ...msg,
          content: msg.content.slice(0, maxChars) + "\n... [truncated]",
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
              return { ...block, text: block.text.slice(0, maxChars) + "\n... [truncated]" };
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
              return { ...block, content: block.content.slice(0, maxChars) + "\n... [truncated]" };
            } else if (Array.isArray(block.content)) {
              return {
                ...block,
                content: (block.content as JsonRecord[]).map((subBlock) => {
                  if (
                    subBlock.type === "text" &&
                    typeof subBlock.text === "string" &&
                    subBlock.text.length > maxChars
                  ) {
                    return {
                      ...subBlock,
                      text: subBlock.text.slice(0, maxChars) + "\n... [truncated]",
                    };
                  }
                  return subBlock;
                }),
              };
            }
          }
          return block;
        }),
      };
    }
    return msg;
  });
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

// ─── Layer 3: Aggressive Purification ───────────────────────────────────────

function purifyHistory(
  messages: JsonRecord[],
  fitsWithinTarget: (msgs: JsonRecord[]) => boolean
): JsonRecord[] {
  // Keep system message(s) and the most recent non-system messages that still fit.
  const system = messages.filter((m) => m.role === "system" || m.role === "developer");
  const nonSystem = messages.filter((m) => m.role !== "system" && m.role !== "developer");

  const buildCandidate = (keep: number, includeSummary: boolean): JsonRecord[] => {
    const keptMessages = keep <= 0 ? [] : nonSystem.slice(-keep);
    const candidate = [...system, ...keptMessages];
    if (includeSummary && keep < nonSystem.length) {
      const dropped = nonSystem.length - keep;
      candidate.splice(system.length, 0, {
        role: "user",
        content: `[Context compressed: ${dropped} earlier messages removed to fit context window]`,
      });
    }
    return candidate;
  };

  let keep = nonSystem.length;
  while (keep >= 0) {
    const withSummary = buildCandidate(keep, true);
    if (fitsWithinTarget(withSummary)) {
      return withSummary;
    }

    const withoutSummary = buildCandidate(keep, false);
    if (fitsWithinTarget(withoutSummary)) {
      return withoutSummary;
    }

    if (keep === 0) break;
    // Gentler decay than 0.7 (which nuked ~30% per step and felt like "half context gone")
    const nextKeep = Math.max(0, Math.floor(keep * 0.9));
    keep = nextKeep < keep ? nextKeep : keep - 1;
  }

  return buildCandidate(0, false);
}
