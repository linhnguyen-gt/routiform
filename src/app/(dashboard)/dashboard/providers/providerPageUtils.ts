export interface ProviderStatsSnapshot {
  total?: number;
  [key: string]: unknown;
}

import { FREE_APIKEY_PROVIDER_IDS } from "@/shared/constants/providers";

export interface ProviderEntry<TProvider = Record<string, unknown>> {
  providerId: string;
  provider: TProvider;
  stats: ProviderStatsSnapshot;
  displayAuthType: "oauth" | "apikey" | "compatible";
  toggleAuthType: "oauth" | "free" | "apikey";
}

type ProviderRecord<TProvider = Record<string, unknown>> = Record<string, TProvider>;

type GetProviderStats = (
  providerId: string,
  authType: "oauth" | "free" | "apikey"
) => ProviderStatsSnapshot;

export function buildProviderEntries<TProvider = Record<string, unknown>>(
  providers: ProviderRecord<TProvider>,
  displayAuthType: ProviderEntry["displayAuthType"],
  toggleAuthType: ProviderEntry["toggleAuthType"],
  getProviderStats: GetProviderStats
): ProviderEntry<TProvider>[] {
  return Object.entries(providers).map(([providerId, provider]) => ({
    providerId,
    provider,
    stats: getProviderStats(providerId, toggleAuthType),
    displayAuthType,
    toggleAuthType,
  }));
}

/** Free providers that use PAT/API key (not browser OAuth) — shown under API Key section. */
function pickFreePatProviders<TProvider>(freeProviders: ProviderRecord<TProvider>) {
  return Object.fromEntries(
    Object.entries(freeProviders).filter(([id]) => FREE_APIKEY_PROVIDER_IDS.has(id))
  ) as ProviderRecord<TProvider>;
}

/** Remaining free-tier providers that still use OAuth-style connect (e.g. Qwen device flow). */
function pickFreeOAuthProviders<TProvider>(freeProviders: ProviderRecord<TProvider>) {
  return Object.fromEntries(
    Object.entries(freeProviders).filter(([id]) => !FREE_APIKEY_PROVIDER_IDS.has(id))
  ) as ProviderRecord<TProvider>;
}

export function buildMergedOAuthProviderEntries<TProvider = Record<string, unknown>>(
  oauthProviders: ProviderRecord<TProvider>,
  freeProviders: ProviderRecord<TProvider>,
  getProviderStats: GetProviderStats
): ProviderEntry<TProvider>[] {
  const freeOAuthOnly = pickFreeOAuthProviders(freeProviders);
  return [
    ...buildProviderEntries(oauthProviders, "oauth", "oauth", getProviderStats),
    ...buildProviderEntries(freeOAuthOnly, "oauth", "free", getProviderStats),
  ];
}

/** API key providers plus free PAT providers (e.g. Qoder AI). */
export function buildMergedApiKeyProviderEntries<TProvider = Record<string, unknown>>(
  apikeyProviders: ProviderRecord<TProvider>,
  freeProviders: ProviderRecord<TProvider>,
  getProviderStats: GetProviderStats
): ProviderEntry<TProvider>[] {
  const freePat = pickFreePatProviders(freeProviders);
  return [
    ...buildProviderEntries(apikeyProviders, "apikey", "apikey", getProviderStats),
    ...buildProviderEntries(freePat, "apikey", "apikey", getProviderStats),
  ];
}

export function filterConfiguredProviderEntries<TProvider>(
  entries: ProviderEntry<TProvider>[],
  showConfiguredOnly: boolean
): ProviderEntry<TProvider>[] {
  if (!showConfiguredOnly) return entries;

  return entries.filter((entry) => Number(entry.stats?.total || 0) > 0);
}
