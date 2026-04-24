export function resolveRetrySettings(config: Record<string, unknown> | null | undefined): {
  maxRetries: number;
  retryDelayMs: number;
} {
  const legacyRetries = Number.isFinite(config?.maxRetries as number)
    ? Number(config!.maxRetries)
    : null;
  const explicitRequestRetry = Number.isFinite(config?.requestRetry as number)
    ? Number(config!.requestRetry)
    : null;
  const maxRetries = Math.max(0, Math.floor(explicitRequestRetry ?? legacyRetries ?? 1));

  const baseDelayMs =
    Number.isFinite(config?.retryDelayMs as number) && Number(config!.retryDelayMs) >= 0
      ? Number(config!.retryDelayMs)
      : 2000;

  const maxRetryIntervalSec =
    Number.isFinite(config?.maxRetryIntervalSec as number) &&
    Number(config!.maxRetryIntervalSec) > 0
      ? Number(config!.maxRetryIntervalSec)
      : null;

  const retryDelayMs =
    maxRetryIntervalSec !== null
      ? Math.min(baseDelayMs, Math.floor(maxRetryIntervalSec * 1000))
      : baseDelayMs;

  return {
    maxRetries,
    retryDelayMs,
  };
}

export function resolveRetryWaitMs(
  baseRetryDelayMs: number,
  cooldownMs: number,
  config: Record<string, unknown> | null | undefined
): number {
  const baseDelay =
    Number.isFinite(baseRetryDelayMs) && baseRetryDelayMs >= 0 ? Number(baseRetryDelayMs) : 0;
  const cooldownDelay = Number.isFinite(cooldownMs) && cooldownMs > 0 ? Number(cooldownMs) : 0;

  const maxRetryIntervalSec =
    Number.isFinite(config?.maxRetryIntervalSec as number) &&
    Number(config!.maxRetryIntervalSec) > 0
      ? Number(config!.maxRetryIntervalSec)
      : null;

  if (maxRetryIntervalSec === null) {
    return Math.max(0, Math.floor(baseDelay));
  }

  let waitMs = Math.max(baseDelay, cooldownDelay);
  waitMs = Math.min(waitMs, Math.floor(maxRetryIntervalSec * 1000));

  return Math.max(0, Math.floor(waitMs));
}
