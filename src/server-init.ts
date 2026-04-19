// Server startup script
import initializeCloudSync from "./shared/services/initializeCloudSync";
import { enforceSecrets } from "./shared/utils/secretsValidator";
import { initAuditLog, cleanupExpiredLogs, logAuditEvent } from "./lib/compliance/index";
import { initConsoleInterceptor } from "./lib/consoleInterceptor";
import { enforceRuntimeEnv } from "./lib/runtime/envValidation";

function getRandomBytes(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function ensureServerSecrets() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === "") {
    process.env.JWT_SECRET = toBase64(getRandomBytes(48));
    console.log("[STARTUP] JWT_SECRET auto-generated for current process");
  }
  if (!process.env.API_KEY_SECRET || process.env.API_KEY_SECRET.trim() === "") {
    process.env.API_KEY_SECRET = toHex(getRandomBytes(32));
    console.log("[STARTUP] API_KEY_SECRET auto-generated for current process");
  }
}

async function startServer() {
  ensureServerSecrets();
  enforceRuntimeEnv();

  // Trigger request-log layout migration during startup, before serving requests.
  await import("./lib/usage/migrations");

  // Console interceptor: capture all console output to log file (must be first)
  initConsoleInterceptor();

  // FASE-01: Validate required secrets before anything else (fail-fast)
  enforceSecrets();

  // Compliance: Initialize audit_log table
  try {
    initAuditLog();
    console.log("[COMPLIANCE] Audit log table initialized");
  } catch (err) {
    console.warn("[COMPLIANCE] Could not initialize audit log:", err.message);
  }

  // Compliance: One-time cleanup of expired logs
  try {
    const cleanup = cleanupExpiredLogs();
    if (
      cleanup.deletedUsage ||
      cleanup.deletedCallLogs ||
      cleanup.deletedProxyLogs ||
      cleanup.deletedRequestDetailLogs ||
      cleanup.deletedAuditLogs ||
      cleanup.deletedMcpAuditLogs
    ) {
      console.log("[COMPLIANCE] Expired log cleanup:", cleanup);
    }
  } catch (err) {
    console.warn("[COMPLIANCE] Log cleanup failed:", err.message);
  }

  console.log("Starting server with cloud sync...");

  try {
    // Initialize cloud sync
    await initializeCloudSync();
    console.log("Server started with cloud sync initialized");

    // Log server start event to audit log
    logAuditEvent({ action: "server.start", details: { timestamp: new Date().toISOString() } });
  } catch (error) {
    console.error("[FATAL] Error initializing cloud sync:", error);
    process.exit(1);
  }

  // Pricing sync: opt-in external pricing data (non-blocking, never fatal)
  if (process.env.PRICING_SYNC_ENABLED === "true") {
    try {
      const { initPricingSync } = await import("./lib/pricingSync");
      await initPricingSync();
    } catch (err) {
      console.warn(
        "[PRICING_SYNC] Could not initialize:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

// Start the server initialization
startServer().catch((err) => {
  console.error("[FATAL] Server initialization failed:", err);
  process.exit(1);
});

// Export for use as module if needed
export default startServer;
