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
 * Reads from DB `contextValidation` setting (managed via UI).
 */
export async function isProxyContextCompressionEnabled(): Promise<boolean> {
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
