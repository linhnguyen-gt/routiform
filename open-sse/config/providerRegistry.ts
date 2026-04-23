/**
 * Provider Registry — Single source of truth for all provider configuration.
 *
 * Adding a new provider? Just add an entry to ./registry-providers.ts.
 * Everything else (PROVIDERS, PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS, executor lookup)
 * is auto-generated from this registry.
 *
 * This file is now a barrel that re-exports from the split registry modules.
 */

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  RegistryModel,
  RegistryOAuth,
  RegistryEntry,
  LegacyProvider,
} from "./registry-types.ts";

// ── Provider Data ─────────────────────────────────────────────────────────
export { REGISTRY } from "./registry-providers.ts";

// ── Generators ────────────────────────────────────────────────────────────
export {
  generateLegacyProviders,
  generateModels,
  generateAliasMap,
} from "./registry-generators.ts";

// ── Local Provider Detection ──────────────────────────────────────────────
export { isLocalProvider, getPassthroughProviders } from "./registry-local.ts";

// ── Registry Lookups ──────────────────────────────────────────────────────
export { getRegistryEntry, getRegisteredProviders } from "./registry-lookup.ts";

// ── Parameter & Reasoning Helpers ─────────────────────────────────────────
export {
  getUnsupportedParams,
  getForceParams,
  getDefaultParams,
  getProviderCategory,
  getBuiltInModelDefaultParams,
  getCustomModelDefaultParams,
  setCustomModelDefaultParams,
  setModelReasoningEffortDefault,
  removeModelReasoningEffortDefault,
  setCustomModelReasoningEffortDefaults,
  getBuiltInModelReasoningEffortDefaults,
  getCustomModelReasoningEffortDefaults,
  getEffectiveModelReasoningEffortDefaults,
} from "./registry-params.ts";
