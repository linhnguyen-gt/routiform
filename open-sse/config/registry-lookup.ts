/**
 * Registry entry lookups and provider listing.
 */

import type { RegistryEntry } from "./registry-types.ts";
import { REGISTRY } from "./registry-providers.ts";

const _byAlias = new Map<string, RegistryEntry>();
for (const entry of Object.values(REGISTRY)) {
  if (entry.alias && entry.alias !== entry.id) {
    _byAlias.set(entry.alias, entry);
  }
}

/** Get registry entry by provider ID or alias */
export function getRegistryEntry(provider: string): RegistryEntry | null {
  return REGISTRY[provider] || _byAlias.get(provider) || null;
}

/** Get all registered provider IDs */
export function getRegisteredProviders(): string[] {
  return Object.keys(REGISTRY);
}
