/**
 * Cost Calculator — extracted from usageDb.js (T-15)
 *
 * Pure function for calculating request cost based on model pricing.
 * No DB interaction — pricing is fetched from localDb.
 *
 * @module lib/usage/costCalculator
 */

/**
 * Normalize model name — strip provider path prefixes.
 * Examples:
 *   "openai/gpt-oss-120b" → "gpt-oss-120b"
 *   "accounts/fireworks/models/gpt-oss-120b" → "gpt-oss-120b"
 *   "deepseek-ai/DeepSeek-R1" → "DeepSeek-R1"
 *   "gpt-oss-120b" → "gpt-oss-120b" (no-op)
 *
 * @param {string} model
 * @returns {string}
 */
export function normalizeModelName(model) {
  if (!model || !model.includes("/")) return model;
  const parts = model.split("/");
  return parts[parts.length - 1];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Calculate cost for a usage entry.
 *
 * @param {string} provider
 * @param {string} model
 * @param {Object} tokens
 * @returns {Promise<number>} Cost in USD
 */
export async function calculateCost(provider, model, tokens) {
  if (!tokens || !provider || !model) return 0;

  try {
    const { getPricingForModel } = await import("@/lib/localDb");

    // Try exact match first, then normalized model name
    let pricing = await getPricingForModel(provider, model);
    if (!pricing) {
      const normalized = normalizeModelName(model);
      if (normalized !== model) {
        pricing = await getPricingForModel(provider, normalized);
      }
    }
    if (!pricing) return 0;

    return computeCostFromPricing(pricing, tokens);
  } catch (error) {
    console.error("Error calculating cost:", error);
    return 0;
  }
}

export function computeCostFromPricing(pricing: unknown, tokens: unknown): number {
  if (!pricing || !tokens) return 0;

  const pricingRecord =
    pricing && typeof pricing === "object" && !Array.isArray(pricing)
      ? (pricing as Record<string, unknown>)
      : {};
  const tokenRecord =
    tokens && typeof tokens === "object" && !Array.isArray(tokens)
      ? (tokens as Record<string, unknown>)
      : {};

  const inputPrice = toNumber(pricingRecord.input, 0);
  const cachedPrice = toNumber(pricingRecord.cached, inputPrice);
  const outputPrice = toNumber(pricingRecord.output, 0);
  const reasoningPrice = toNumber(pricingRecord.reasoning, outputPrice);
  const cacheCreationPrice = toNumber(pricingRecord.cache_creation, inputPrice);

  let cost = 0;

  const inputTokens = toNumber(
    tokenRecord.input ?? tokenRecord.prompt_tokens ?? tokenRecord.input_tokens,
    0
  );
  const cachedTokens = toNumber(
    tokenRecord.cacheRead ?? tokenRecord.cached_tokens ?? tokenRecord.cache_read_input_tokens,
    0
  );
  const nonCachedInput = Math.max(0, inputTokens - cachedTokens);
  cost += nonCachedInput * (inputPrice / 1000000);

  if (cachedTokens > 0) {
    cost += cachedTokens * (cachedPrice / 1000000);
  }

  const outputTokens = toNumber(
    tokenRecord.output ?? tokenRecord.completion_tokens ?? tokenRecord.output_tokens,
    0
  );
  cost += outputTokens * (outputPrice / 1000000);

  const reasoningTokens = toNumber(tokenRecord.reasoning ?? tokenRecord.reasoning_tokens, 0);
  if (reasoningTokens > 0) {
    cost += reasoningTokens * (reasoningPrice / 1000000);
  }

  const cacheCreationTokens = toNumber(
    tokenRecord.cacheCreation ?? tokenRecord.cache_creation_input_tokens,
    0
  );
  if (cacheCreationTokens > 0) {
    cost += cacheCreationTokens * (cacheCreationPrice / 1000000);
  }

  return cost;
}
