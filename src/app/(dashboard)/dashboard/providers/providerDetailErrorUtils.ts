import type { ConnectionRowConnection } from "./[id]/types";
import { ERROR_TYPE_LABELS } from "./providerDetailErrorConstants";

type Translator = (key: string, valuesOrFallback?: unknown) => string;
export { ERROR_TYPE_LABELS };

export function inferErrorType(
  connection: ConnectionRowConnection,
  isCooldown: boolean
): string | null {
  if (isCooldown) return "upstream_rate_limited";
  if (connection.testStatus === "banned") return "banned";
  if (connection.testStatus === "credits_exhausted") return "credits_exhausted";
  if (connection.lastErrorType) return connection.lastErrorType;

  const code = Number(connection.errorCode);
  if (code === 401 || code === 403) return "upstream_auth_error";
  if (code === 429) return "upstream_rate_limited";
  if (code >= 500) return "upstream_unavailable";

  const message = (connection.lastError || "").toLowerCase();
  if (!message) return null;
  if (
    message.includes("runtime") ||
    message.includes("not runnable") ||
    message.includes("not installed") ||
    message.includes("healthcheck")
  ) {
    return "runtime_error";
  }
  if (message.includes("refresh failed")) return "token_refresh_failed";
  if (message.includes("token expired") || message.includes("expired")) return "token_expired";
  if (
    message.includes("invalid api key") ||
    message.includes("token invalid") ||
    message.includes("revoked") ||
    message.includes("access denied") ||
    message.includes("unauthorized")
  ) {
    return "upstream_auth_error";
  }
  if (
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("too many requests") ||
    message.includes("429")
  ) {
    return "upstream_rate_limited";
  }
  if (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econn") ||
    message.includes("enotfound")
  ) {
    return "network_error";
  }
  if (message.includes("not supported")) return "unsupported";
  return "upstream_error";
}

export function getStatusPresentation(
  connection: ConnectionRowConnection,
  effectiveStatus: string,
  isCooldown: boolean,
  t: Translator
): {
  statusVariant: string;
  statusLabel: string;
  errorType: string | null;
  errorBadge: { labelKey: string; variant: string } | null;
  errorTextClass: string;
} {
  if (connection.isActive === false) {
    return {
      statusVariant: "default",
      statusLabel: t("statusDisabled"),
      errorType: null,
      errorBadge: null,
      errorTextClass: "text-text-muted",
    };
  }

  if (effectiveStatus === "active" || effectiveStatus === "success") {
    return {
      statusVariant: "success",
      statusLabel: t("statusConnected"),
      errorType: null,
      errorBadge: null,
      errorTextClass: "text-text-muted",
    };
  }

  const errorType = inferErrorType(connection, isCooldown);
  const errorBadge = errorType ? ERROR_TYPE_LABELS[errorType] || null : null;

  if (errorType === "runtime_error") {
    return {
      statusVariant: "warning",
      statusLabel: t("statusRuntimeIssue"),
      errorType,
      errorBadge,
      errorTextClass: "text-yellow-600 dark:text-yellow-400",
    };
  }

  if (errorType === "account_deactivated") {
    return {
      statusVariant: "error",
      statusLabel: t("statusDeactivated", "Deactivated"),
      errorType,
      errorBadge,
      errorTextClass: "text-red-600 font-bold",
    };
  }

  if (
    errorType === "upstream_auth_error" ||
    errorType === "auth_missing" ||
    errorType === "token_refresh_failed" ||
    errorType === "token_expired"
  ) {
    return {
      statusVariant: "error",
      statusLabel: t("statusAuthFailed"),
      errorType,
      errorBadge,
      errorTextClass: "text-red-500",
    };
  }

  if (errorType === "upstream_rate_limited") {
    return {
      statusVariant: "warning",
      statusLabel: t("statusRateLimited"),
      errorType,
      errorBadge,
      errorTextClass: "text-yellow-600 dark:text-yellow-400",
    };
  }

  if (errorType === "network_error") {
    return {
      statusVariant: "warning",
      statusLabel: t("statusNetworkIssue"),
      errorType,
      errorBadge,
      errorTextClass: "text-yellow-600 dark:text-yellow-400",
    };
  }

  if (errorType === "unsupported") {
    return {
      statusVariant: "default",
      statusLabel: t("statusTestUnsupported"),
      errorType,
      errorBadge,
      errorTextClass: "text-text-muted",
    };
  }

  if (errorType === "banned") {
    return {
      statusVariant: "error",
      statusLabel: t("statusBanned", "Banned (403)"),
      errorType,
      errorBadge,
      errorTextClass: "text-red-600 font-bold",
    };
  }

  if (errorType === "credits_exhausted") {
    return {
      statusVariant: "warning",
      statusLabel: t("statusCreditsExhausted", "Out of Credits"),
      errorType,
      errorBadge,
      errorTextClass: "text-amber-500",
    };
  }

  const fallbackStatusMap: Record<string, string> = {
    unavailable: t("statusUnavailable"),
    failed: t("statusFailed"),
    error: t("statusError"),
  };

  return {
    statusVariant: "error",
    statusLabel: fallbackStatusMap[effectiveStatus] || effectiveStatus || t("statusError"),
    errorType,
    errorBadge,
    errorTextClass: "text-red-500",
  };
}
