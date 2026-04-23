/**
 * Local provider detection and passthrough provider set.
 */

import { REGISTRY } from "./registry-providers.ts";

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  ...(typeof process !== "undefined" && process.env.LOCAL_HOSTNAMES
    ? process.env.LOCAL_HOSTNAMES.split(",")
        .map((h) => h.trim())
        .filter(Boolean)
    : []),
]);

/**
 * Detect if a base URL points to a local inference backend.
 * Used for shorter 404 cooldowns (model-only, not connection) and health check targets.
 *
 * Operators can extend via LOCAL_HOSTNAMES env var (comma-separated) for Docker
 * hostnames (e.g., LOCAL_HOSTNAMES=omlx,mlx-audio).
 */
export function isLocalProvider(baseUrl?: string | null): boolean {
  if (!baseUrl) return false;
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname;
    return (
      LOCAL_HOSTNAMES.has(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
}

const _passthroughProviderIds: Set<string> | null = (() => {
  try {
    const ids = new Set<string>();
    for (const entry of Object.values(REGISTRY)) {
      if (entry.passthroughModels) ids.add(entry.id);
    }
    return ids;
  } catch {
    return null;
  }
})();

export function getPassthroughProviders(): Set<string> {
  return _passthroughProviderIds ?? new Set<string>();
}
