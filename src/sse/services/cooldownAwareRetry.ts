type RetryConfig = {
  maxRetries: number;
  maxRetryIntervalMs: number;
};

const DEFAULT_MAX_RETRIES = 0;
const DEFAULT_MAX_RETRY_INTERVAL_SEC = 5;

function toNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function buildCooldownAwareRetryConfig(settings: unknown): RetryConfig {
  const obj = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};

  const maxRetries = toNonNegativeInt(obj.requestRetry, DEFAULT_MAX_RETRIES);
  const maxRetryIntervalSec = toNonNegativeInt(
    obj.maxRetryIntervalSec,
    DEFAULT_MAX_RETRY_INTERVAL_SEC
  );

  return {
    maxRetries,
    maxRetryIntervalMs: maxRetryIntervalSec * 1000,
  };
}

export function shouldRetryOnCooldown(params: {
  status: number;
  cooldownMs: number;
  retryAttempt: number;
  config: RetryConfig;
}): boolean {
  const retriableStatuses = new Set([429, 502, 503, 504]);
  if (!retriableStatuses.has(params.status)) return false;
  if (params.config.maxRetries <= 0) return false;
  if (params.retryAttempt >= params.config.maxRetries) return false;
  if (params.cooldownMs <= 0) return false;
  if (params.cooldownMs > params.config.maxRetryIntervalMs) return false;
  return true;
}

export async function waitForCooldown(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
