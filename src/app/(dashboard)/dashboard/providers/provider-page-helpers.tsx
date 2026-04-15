import { getErrorCode, getRelativeTime } from "@/shared/utils";
import { Badge } from "@/shared/components";
import type { Connection, ProviderStats } from "./types";
import type { ReactElement } from "react";

export const CC_COMPATIBLE_LABEL = "CC Compatible";
export const ADD_CC_COMPATIBLE_LABEL = "Add CC Compatible";
export const CC_COMPATIBLE_DEFAULT_CHAT_PATH = "/v1/messages?beta=true";

/**
 * Check if a connection has a refresh failure warning (active but token refresh failed)
 */
export function isRefreshFailureWarning(conn: Connection): boolean {
  return conn.isActive !== false && conn.lastErrorType === "token_refresh_failed";
}

/**
 * Get status display badges for a provider (connected, error, warning counts)
 */
export function getStatusDisplay(
  connected: number,
  error: number,
  warning: number,
  errorCode: string | null,
  t: (key: string, params?: Record<string, unknown>) => string,
  tc: (key: string) => string
): ReactElement | ReactElement[] | string {
  const parts = [];
  if (connected > 0) {
    parts.push(
      <Badge key="connected" variant="success" size="sm" dot>
        {t("connected", { count: connected })}
      </Badge>
    );
  }
  if (error > 0) {
    const errText = errorCode
      ? t("errorCount", { count: error, code: errorCode })
      : t("errorCountNoCode", { count: error });
    parts.push(
      <Badge key="error" variant="error" size="sm" dot>
        {errText}
      </Badge>
    );
  }
  if (warning > 0) {
    parts.push(
      <Badge key="warning" variant="warning" size="sm" dot>
        {warning} {tc("warning")}
      </Badge>
    );
  }
  if (parts.length === 0) {
    return <span className="text-text-muted">{t("noConnections")}</span>;
  }
  return parts;
}

/**
 * Extract error tag from connection for display (AUTH, 429, 5XX, NET, RUNTIME, ERR)
 */
export function getConnectionErrorTag(connection: Connection | null): string | null {
  if (!connection) return null;

  const explicitType = connection.lastErrorType;
  if (explicitType === "runtime_error") return "RUNTIME";
  if (
    explicitType === "upstream_auth_error" ||
    explicitType === "auth_missing" ||
    explicitType === "token_refresh_failed" ||
    explicitType === "token_expired"
  ) {
    return "AUTH";
  }
  if (explicitType === "upstream_rate_limited") return "429";
  if (explicitType === "upstream_unavailable") return "5XX";
  if (explicitType === "network_error") return "NET";

  const numericCode = Number(connection.errorCode);
  if (Number.isFinite(numericCode) && numericCode >= 400) {
    return String(numericCode);
  }

  const fromMessage = getErrorCode(connection.lastError || "");
  if (fromMessage === "401" || fromMessage === "403") return "AUTH";
  if (fromMessage && fromMessage !== "ERR") return fromMessage;

  const msg = (connection.lastError || "").toLowerCase();
  if (msg.includes("runtime") || msg.includes("not runnable") || msg.includes("not installed"))
    return "RUNTIME";
  if (
    msg.includes("invalid api key") ||
    msg.includes("token invalid") ||
    msg.includes("revoked") ||
    msg.includes("unauthorized")
  )
    return "AUTH";

  return "ERR";
}

/**
 * Calculate provider statistics from connections list
 */
export function calculateProviderStats(
  connections: Connection[],
  providerId: string,
  authType: "oauth" | "free" | "apikey",
  expirations: { list?: { provider: string; status: string }[] } | null
): ProviderStats {
  const providerConnections = connections.filter((c) => {
    if (c.provider !== providerId) return false;
    if (authType === "free") return true;
    return c.authType === authType;
  });

  // Helper: check if connection is effectively active (cooldown expired)
  const getEffectiveStatus = (conn: Connection) => {
    const isCooldown =
      conn.rateLimitedUntil && new Date(conn.rateLimitedUntil).getTime() > Date.now();
    return conn.testStatus === "unavailable" && !isCooldown ? "active" : conn.testStatus;
  };

  const connected = providerConnections.filter((c) => {
    const status = getEffectiveStatus(c);
    return status === "active" || status === "success" || isRefreshFailureWarning(c);
  }).length;

  const warningConns = providerConnections.filter((c) => isRefreshFailureWarning(c));
  const errorConns = providerConnections.filter((c) => {
    const status = getEffectiveStatus(c);
    return (
      (status === "error" || status === "expired" || status === "unavailable") &&
      !isRefreshFailureWarning(c)
    );
  });

  const error = errorConns.length;
  const warning = warningConns.length;
  const total = providerConnections.length;

  // Check if all connections are manually disabled
  const allDisabled = total > 0 && providerConnections.every((c) => c.isActive === false);

  // Get latest error info
  const latestError = errorConns.sort(
    (a, b) => new Date(b.lastErrorAt || 0).getTime() - new Date(a.lastErrorAt || 0).getTime()
  )[0];
  const errorCode = latestError ? getConnectionErrorTag(latestError) : null;
  const errorTime = latestError?.lastErrorAt ? getRelativeTime(latestError.lastErrorAt) : null;

  // Check expirations
  const providerExpirations = expirations?.list?.filter((e) => e.provider === providerId) || [];
  const hasExpired = providerExpirations.some((e) => e.status === "expired");
  const hasExpiringSoon = providerExpirations.some((e) => e.status === "expiring_soon");
  let expiryStatus: "expired" | "expiring_soon" | null = null;
  if (hasExpired) expiryStatus = "expired";
  else if (hasExpiringSoon) expiryStatus = "expiring_soon";

  return { connected, error, warning, total, errorCode, errorTime, allDisabled, expiryStatus };
}
