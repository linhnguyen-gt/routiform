/**
 * UI-driven proxy context validation (vs oversized prompts).
 * Reads from settings DB with short TTL to avoid per-request SQLite hits.
 */

type CacheEntry = { value: boolean; at: number };

const TTL_MS = 4000;
let cache: CacheEntry | null = null;

export function invalidateContextValidationSettingsCache(): void {
  cache = null;
}

/**
 * When true, `validateAndCompressContext` may compress oversized bodies.
 * Priority: explicit env (ROUTIFORM_CONTEXT_VALIDATION) → DB `contextValidation`.
 */
export async function isProxyContextCompressionEnabled(): Promise<boolean> {
  const env = process.env.ROUTIFORM_CONTEXT_VALIDATION?.trim().toLowerCase() ?? "";
  if (
    env === "auto-compress" ||
    env === "compress" ||
    env === "on" ||
    env === "1" ||
    env === "true"
  ) {
    return true;
  }
  if (
    env === "passthrough" ||
    env === "off" ||
    env === "disabled" ||
    env === "0" ||
    env === "false"
  ) {
    return false;
  }

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return cache.value;
  }

  const { getSettings } = await import("@/lib/db/settings");
  const settings = await getSettings();
  const mode = (settings as { contextValidation?: string }).contextValidation;
  const value = mode === "auto-compress";
  cache = { value, at: now };
  return value;
}
