/**
 * Node.js-only instrumentation logic.
 *
 * Separated from instrumentation.ts so that Turbopack's Edge bundler
 * does not trace into Node.js-only modules (fs, path, os, better-sqlite3, etc.)
 * and emit spurious "not supported in Edge Runtime" warnings.
 */

function getRandomBytes(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureSecrets(): Promise<void> {
  let getPersistedSecret = (_key: string): string | null => null;
  let persistSecret = (_key: string, _value: string): void => {};

  try {
    ({ getPersistedSecret, persistSecret } = await import("@/lib/db/secrets"));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      "[STARTUP] Secret persistence unavailable; falling back to process-local secrets:",
      msg
    );
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === "") {
    const persisted = getPersistedSecret("jwtSecret");
    if (persisted) {
      process.env.JWT_SECRET = persisted;
      console.log("[STARTUP] JWT_SECRET restored from persistent store");
    } else {
      const generated = toBase64(getRandomBytes(48));
      process.env.JWT_SECRET = generated;
      persistSecret("jwtSecret", generated);
      console.log("[STARTUP] JWT_SECRET auto-generated and persisted (random 64-char secret)");
    }
  }

  if (!process.env.API_KEY_SECRET || process.env.API_KEY_SECRET.trim() === "") {
    const persisted = getPersistedSecret("apiKeySecret");
    if (persisted) {
      process.env.API_KEY_SECRET = persisted;
    } else {
      const generated = toHex(getRandomBytes(32));
      process.env.API_KEY_SECRET = generated;
      persistSecret("apiKeySecret", generated);
      console.log(
        "[STARTUP] API_KEY_SECRET auto-generated and persisted (random 64-char hex secret)"
      );
    }
  }
}

export async function registerNodejs(): Promise<void> {
  // Initialize proxy fetch patch FIRST (before any HTTP requests)
  await import("@routiform/open-sse/index.ts");
  console.log("[STARTUP] Global fetch proxy patch initialized");

  await ensureSecrets();

  // Trigger request-log layout migration during startup, before any request hits usageDb.
  await import("@/lib/usage/migrations");

  const { initConsoleInterceptor } = await import("@/lib/consoleInterceptor");
  initConsoleInterceptor();

  const [
    { initGracefulShutdown },
    { initApiBridgeServer },
    { startBackgroundRefresh },
    { startProviderLimitsSyncScheduler },
    { getSettings },
  ] = await Promise.all([
    import("@/lib/gracefulShutdown"),
    import("@/lib/apiBridgeServer"),
    import("@/domain/quotaCache"),
    import("@/shared/services/providerLimitsSyncScheduler"),
    import("@/lib/db/settings"),
  ]);

  initGracefulShutdown();
  initApiBridgeServer();
  startBackgroundRefresh();
  console.log("[STARTUP] Quota cache background refresh started");
  startProviderLimitsSyncScheduler();
  console.log("[STARTUP] Provider limits sync scheduler started");

  try {
    const { setCustomAliases } = await import("@routiform/open-sse/services/modelDeprecation.ts");
    const settings = await getSettings();

    if (settings.modelAliases) {
      const aliases =
        typeof settings.modelAliases === "string"
          ? JSON.parse(settings.modelAliases)
          : settings.modelAliases;
      if (aliases && typeof aliases === "object") {
        setCustomAliases(aliases);
        console.log(
          `[STARTUP] Restored ${Object.keys(aliases).length} custom model alias(es) from settings`
        );
      }
    }

    // Migrate legacy Codex service tier settings to per-connection defaults
    try {
      const { migrateCodexConnectionDefaultsFromLegacySettings } =
        await import("@/lib/providers/codexConnectionDefaults");
      const migrationResult = await migrateCodexConnectionDefaultsFromLegacySettings();
      if (migrationResult.migrated) {
        console.log(
          `[STARTUP] Migrated Codex connection defaults: ${migrationResult.updatedConnectionIds.length} connection(s) updated`
        );
      }
    } catch (err: unknown) {
      console.warn("[STARTUP] Codex connection defaults migration failed:", err);
    }

    if (settings.backgroundDegradation) {
      try {
        const bgSettings =
          typeof settings.backgroundDegradation === "string"
            ? JSON.parse(settings.backgroundDegradation)
            : settings.backgroundDegradation;
        const { setBackgroundDegradationConfig } =
          await import("@routiform/open-sse/services/backgroundTaskDetector.ts");
        setBackgroundDegradationConfig(bgSettings);
        console.log(`[STARTUP] Restored background task degradation config from settings`);
      } catch (err: unknown) {
        console.warn(`[STARTUP] Failed to parse background degradation settings:`, err);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[STARTUP] Could not restore runtime settings:", msg);
  }

  try {
    const { initAuditLog, cleanupExpiredLogs } = await import("@/lib/compliance/index");
    initAuditLog();
    console.log("[COMPLIANCE] Audit log table initialized");

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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[COMPLIANCE] Could not initialize audit log:", msg);
  }
}
