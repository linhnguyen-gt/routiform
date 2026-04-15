/**
 * Token Health API Route — Batch G
 *
 * Exposes aggregate health status of OAuth tokens.
 * Used by TokenHealthBadge in the Header.
 */

import { getProviderConnections } from "@/lib/localDb";

function isRefreshFailureWarning(conn: unknown) {
  if (!conn || typeof conn !== "object") return false;
  const c = conn as Record<string, unknown>;
  const isActive = "isActive" in c ? c.isActive : true;
  const lastErrorType =
    "lastErrorType" in c && typeof c.lastErrorType === "string" ? c.lastErrorType : "";
  return isActive !== false && lastErrorType === "token_refresh_failed";
}

function isErroredConnection(conn: unknown) {
  return (
    !isRefreshFailureWarning(conn) &&
    ["error", "expired", "unavailable"].includes(
      String((conn as Record<string, unknown>).testStatus)
    )
  );
}

function isHealthyConnection(conn: unknown) {
  return (
    !isRefreshFailureWarning(conn) &&
    !isErroredConnection(conn) &&
    !(conn as Record<string, unknown>).lastError
  );
}

export async function GET() {
  try {
    const connections = await getProviderConnections({ authType: "oauth" });
    const oauthConns = (connections || []).filter((c) => c.isActive && c.refreshToken);

    const total = oauthConns.length;
    const healthy = oauthConns.filter((c) => isHealthyConnection(c)).length;
    const errored = oauthConns.filter((c) => isErroredConnection(c)).length;
    const warning = oauthConns.filter((c) => isRefreshFailureWarning(c)).length;
    const lastCheck = oauthConns.reduce((latest, c) => {
      if (!c.lastHealthCheckAt) return latest;
      return latest && latest > c.lastHealthCheckAt ? latest : c.lastHealthCheckAt;
    }, null);

    return Response.json({
      total,
      healthy,
      errored,
      warning,
      lastCheckAt: lastCheck,
      status: errored > 0 ? "error" : warning > 0 ? "warning" : "healthy",
    });
  } catch (err) {
    return Response.json({ error: err.message, status: "unknown" }, { status: 500 });
  }
}
