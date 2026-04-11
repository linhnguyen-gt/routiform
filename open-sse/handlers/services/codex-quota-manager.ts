import { updateProviderConnection } from "@/lib/db/providers";
import {
  getCodexModelScope,
  getCodexResetTime,
  parseCodexQuotaHeaders,
} from "../../executors/codex.ts";

/**
 * Codex quota management service
 * Extracted from chatCore.ts for better modularity
 */

/**
 * Persists Codex quota state from response headers to the database
 * @param options - Configuration options
 * @param options.provider - Provider name (must be "codex")
 * @param options.connectionId - Connection ID for the provider
 * @param options.credentials - Provider credentials object
 * @param options.model - Model name
 * @param options.requestedModel - Requested model name (fallback)
 * @param options.headers - Response headers containing quota information
 * @param options.status - HTTP status code (429 triggers rate limit tracking)
 * @param options.log - Logger instance
 */
export async function persistCodexQuotaState(options: {
  provider: string;
  connectionId?: string;
  credentials: { providerSpecificData?: Record<string, unknown> } | null;
  model?: string;
  requestedModel?: string;
  headers: Headers | Record<string, string> | null;
  status?: number;
  log?: {
    debug?: (category: string, message: string) => void;
  };
}) {
  const {
    provider,
    connectionId,
    credentials,
    model,
    requestedModel,
    headers,
    status = 0,
    log,
  } = options;

  if (provider !== "codex" || !connectionId || !headers) return;

  try {
    const quota = parseCodexQuotaHeaders(headers as Headers);
    if (!quota) return;

    const existingProviderData =
      credentials?.providerSpecificData && typeof credentials.providerSpecificData === "object"
        ? credentials.providerSpecificData
        : {};
    const scope = getCodexModelScope(model || requestedModel || "");
    const quotaState = {
      usage5h: quota.usage5h,
      limit5h: quota.limit5h,
      resetAt5h: quota.resetAt5h,
      usage7d: quota.usage7d,
      limit7d: quota.limit7d,
      resetAt7d: quota.resetAt7d,
      scope,
      updatedAt: new Date().toISOString(),
    };

    const nextProviderData: Record<string, unknown> = {
      ...existingProviderData,
      codexQuotaState: quotaState,
    };

    // T03/T09: on 429, persist exact reset time per scope to avoid global over-blocking.
    if (status === 429) {
      const resetTimeMs = getCodexResetTime(quota);
      if (resetTimeMs && resetTimeMs > Date.now()) {
        const scopeUntil = new Date(resetTimeMs).toISOString();
        const scopeMapRaw =
          existingProviderData &&
          typeof existingProviderData === "object" &&
          existingProviderData.codexScopeRateLimitedUntil &&
          typeof existingProviderData.codexScopeRateLimitedUntil === "object"
            ? existingProviderData.codexScopeRateLimitedUntil
            : {};

        nextProviderData.codexScopeRateLimitedUntil = {
          ...(scopeMapRaw as Record<string, unknown>),
          [scope]: scopeUntil,
        };
      }
    }

    await updateProviderConnection(connectionId, {
      providerSpecificData: nextProviderData,
    });

    if (credentials) {
      credentials.providerSpecificData = nextProviderData;
    }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    log?.debug?.("CODEX", `Failed to persist codex quota state: ${errMessage}`);
  }
}
