/** Status codes that mark semaphore + record circuit breaker failures */
export const TRANSIENT_FOR_BREAKER = [429, 502, 503, 504];

export const COMBO_BAD_REQUEST_FALLBACK_PATTERNS = [
  /\bprohibited_content\b/i,
  /request blocked by .*api/i,
  /provided message roles? is not valid/i,
  /unsupported .*message role/i,
  /requested model .* not supported/i,
  /model .* is not supported/i,
  /improperly formed request/i,
  /tool_choice parameter does not support being set to required or object/i,
  /no such tool available/i,
  /unsupported content part type/i,
  /tool(?:_call|_use)? .* not (?:available|found)/i,
  /does not support (?:image|vision|multimodal)/i,
  /image (?:input|analysis) (?:is )?not supported/i,
  /unsupported .*image/i,
  /provider returned error/i,
];

export const ALL_ACCOUNTS_RATE_LIMITED_PATTERNS = [
  /all\s+accounts?.*rate.?limit/i,
  /service temporarily unavailable/i,
];

export const MAX_COMBO_DEPTH = 3;

/** Bootstrap defaults from ClawRouter benchmark (used when no local latency history exists yet) */
export const DEFAULT_MODEL_P95_MS: Record<string, number> = {
  "grok-4-fast-non-reasoning": 1143,
  "grok-4-1-fast-non-reasoning": 1244,
  "gemini-2.5-flash": 1238,
  "kimi-k2.5": 1646,
  "gpt-4o-mini": 2764,
  "claude-sonnet-4.6": 4000,
  "claude-opus-4.6": 6000,
  "deepseek-chat": 2000,
};

export const MIN_HISTORY_SAMPLES = 10;
