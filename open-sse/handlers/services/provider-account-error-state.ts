import { updateProviderConnection } from "@/lib/db/providers";
import { createLogger } from "@/shared/utils/logger";
import { COOLDOWN_MS } from "../../config/constants.ts";
import { lockModelIfPerModelQuota } from "../../services/accountFallback.ts";
import { PROVIDER_ERROR_TYPES, classifyProviderError } from "../../services/errorClassifier.ts";
import type { PersistProviderAccountErrorStateOptions } from "../types/chat-core.ts";

const log = createLogger("provider-account-error-state");

export async function persistProviderAccountErrorState({
  connectionId,
  provider,
  model,
  statusCode,
  message,
  retryAfterMs,
}: PersistProviderAccountErrorStateOptions): Promise<void> {
  const errorType = classifyProviderError(statusCode, message);
  if (!connectionId || !errorType) return;

  try {
    if (errorType === PROVIDER_ERROR_TYPES.FORBIDDEN) {
      await updateProviderConnection(connectionId, {
        isActive: false,
        testStatus: "banned",
        lastErrorType: errorType,
        lastError: message,
        errorCode: statusCode,
      });
      console.warn(
        `[provider] Node ${connectionId} banned (${statusCode}) — disabling permanently`
      );
    } else if (errorType === PROVIDER_ERROR_TYPES.ACCOUNT_DEACTIVATED) {
      await updateProviderConnection(connectionId, {
        isActive: false,
        testStatus: "deactivated",
        lastErrorType: errorType,
        lastError: message,
        errorCode: statusCode,
      });
      console.warn(
        `[provider] Node ${connectionId} account deactivated (${statusCode}) — disabling permanently`
      );
    } else if (errorType === PROVIDER_ERROR_TYPES.RATE_LIMITED) {
      if (
        lockModelIfPerModelQuota(
          provider,
          connectionId,
          model,
          "rate_limited",
          retryAfterMs || COOLDOWN_MS.rateLimit
        )
      ) {
        console.warn(
          `[provider] Node ${connectionId} model-only rate limited (${statusCode}) for ${model} - ${Math.ceil((retryAfterMs || COOLDOWN_MS.rateLimit) / 1000)}s (connection stays active)`
        );
      } else {
        const rateLimitedUntil = new Date(Date.now() + retryAfterMs).toISOString();
        await updateProviderConnection(connectionId, {
          rateLimitedUntil: rateLimitedUntil,
          testStatus: "credits_exhausted",
          lastErrorType: errorType,
          lastError: message,
          errorCode: statusCode,
          healthCheckInterval: null,
          lastHealthCheckAt: null,
        });
        console.warn(
          `[provider] Node ${connectionId} rate limited (${statusCode}) - Next available at ${rateLimitedUntil}`
        );
      }
    } else if (errorType === PROVIDER_ERROR_TYPES.QUOTA_EXHAUSTED) {
      if (
        lockModelIfPerModelQuota(
          provider,
          connectionId,
          model,
          "quota_exhausted",
          retryAfterMs || COOLDOWN_MS.rateLimit
        )
      ) {
        console.warn(
          `[provider] Node ${connectionId} model-only quota exhausted (${statusCode}) for ${model} - ${Math.ceil((retryAfterMs || COOLDOWN_MS.rateLimit) / 1000)}s (connection stays active)`
        );
      } else {
        await updateProviderConnection(connectionId, {
          testStatus: "credits_exhausted",
          lastErrorType: errorType,
          lastError: message,
          errorCode: statusCode,
        });
        console.warn(`[provider] Node ${connectionId} exhausted quota (${statusCode})`);
      }
    } else if (errorType === PROVIDER_ERROR_TYPES.UNAUTHORIZED) {
      await updateProviderConnection(connectionId, {
        lastErrorType: errorType,
        lastError: message,
        errorCode: statusCode,
      });
    } else if (errorType === PROVIDER_ERROR_TYPES.OAUTH_INVALID_TOKEN) {
      await updateProviderConnection(connectionId, {
        lastErrorType: errorType,
        lastError: message,
        errorCode: statusCode,
      });
      console.warn(
        `[provider] Node ${connectionId} OAuth token invalid (${statusCode}) — token refresh available`
      );
    } else if (errorType === PROVIDER_ERROR_TYPES.PROJECT_ROUTE_ERROR) {
      await updateProviderConnection(connectionId, {
        lastErrorType: errorType,
        lastError: message,
        errorCode: statusCode,
      });
      console.warn(
        `[provider] Node ${connectionId} project routing error (${statusCode}) — not banning`
      );
    }
  } catch (err) {
    log.error(
      {
        err,
        operation: "persistProviderAccountErrorState",
        provider,
        providerAccountId: connectionId,
        model,
        statusCode,
        errorType,
        retryAfterMs,
      },
      "Failed to persist provider account error state"
    );
  }
}
