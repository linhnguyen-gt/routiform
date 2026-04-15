/**
 * API Manager — domain types for the API key management page.
 *
 * These types reflect the shape returned by the /api/keys endpoint and
 * related APIs, which differs from the simpler `ApiKey` domain type in
 * `@/types/apiKey`.
 */

/** Time-based access schedule for rate-limiting key usage by day/time. */
export interface AccessSchedule {
  enabled: boolean;
  from: string;
  until: string;
  days: number[];
  tz: string;
}

/** Full API key record as returned from the /api/keys endpoint. */
export interface ApiKeyFull {
  id: string;
  name: string;
  key: string;
  allowedModels: string[] | null;
  allowedConnections: string[] | null;
  noLog?: boolean;
  autoResolve?: boolean;
  isActive?: boolean;
  maxSessions?: number;
  accessSchedule?: AccessSchedule | null;
  createdAt: string;
}

/** Lightweight provider connection reference used in permission selectors. */
export interface ProviderConnectionRef {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
}

/** Usage statistics for a single API key. */
export interface KeyUsageStats {
  totalRequests: number;
  lastUsed: string | null;
}

/** A model entry from /v1/models. */
export interface Model {
  id: string;
  owned_by: string;
}

/** Tuple type for models grouped by provider: [providerName, models[]]. */
export type ProviderGroup = [provider: string, models: Model[]];
