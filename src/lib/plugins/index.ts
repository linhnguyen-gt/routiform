/**
 * Plugin/Middleware Architecture — L-8
 *
 * Pre/post hooks on the request pipeline. Plugins are registered
 * with a priority (lower = runs first) and can intercept requests
 * before they reach the chat handler or modify responses after.
 *
 * Lifecycle:
 *   onRequest  → runs BEFORE chat handler (can block/modify request)
 *   onResponse → runs AFTER  chat handler (can modify/log response)
 *   onError    → runs on handler errors (can recover or re-throw)
 *
 * @module lib/plugins
 */

// ── Types ──

export interface PluginContext {
  /** Unique request ID */
  requestId: string;
  /** Request body (parsed JSON) */
  body: Record<string, unknown>;
  /** Model string */
  model: string;
  /** Provider (if resolved) */
  provider?: string;
  /** API key info */
  apiKeyInfo?: Record<string, unknown>;
  /** Arbitrary metadata plugins can share */
  metadata: Record<string, unknown>;
}

export interface PluginResult {
  /** If true, stop processing further plugins and return immediately */
  blocked?: boolean;
  /** Optional response to return if blocked */
  response?: unknown;
  /** Modified body (if any) */
  body?: unknown;
  /** Modified metadata */
  metadata?: Record<string, unknown>;
}

export interface Plugin {
  /** Unique plugin name */
  name: string;
  /** Priority (lower = runs first, default 100) */
  priority?: number;
  /** Whether the plugin is enabled */
  enabled?: boolean;
  /** Called before the chat handler */
  onRequest?: (ctx: PluginContext) => Promise<PluginResult | void> | PluginResult | void;
  /** Called after the chat handler */
  onResponse?: (ctx: PluginContext, response: unknown) => Promise<unknown | void> | unknown | void;
  /** Called on handler error */
  onError?: (ctx: PluginContext, error: Error) => Promise<unknown | void> | unknown | void;
}

// ── Registry ──

const _plugins: Plugin[] = [];

/**
 * Register a plugin. Plugins are sorted by priority on each registration.
 */
export function registerPlugin(plugin: Plugin): void {
  // Set defaults
  plugin.priority = plugin.priority ?? 100;
  plugin.enabled = plugin.enabled ?? true;

  // Remove existing plugin with same name (re-registration)
  const idx = _plugins.findIndex((p) => p.name === plugin.name);
  if (idx !== -1) _plugins.splice(idx, 1);

  _plugins.push(plugin);
  _plugins.sort((a, b) => (a.priority || 100) - (b.priority || 100));

  console.log(
    `[Plugins] Registered "${plugin.name}" (priority: ${plugin.priority}, enabled: ${plugin.enabled})`
  );
}

/**
 * Unregister a plugin by name.
 */
export function unregisterPlugin(name: string): boolean {
  const idx = _plugins.findIndex((p) => p.name === name);
  if (idx === -1) return false;
  _plugins.splice(idx, 1);
  return true;
}

/**
 * Enable/disable a plugin at runtime.
 */
export function setPluginEnabled(name: string, enabled: boolean): boolean {
  const plugin = _plugins.find((p) => p.name === name);
  if (!plugin) return false;
  plugin.enabled = enabled;
  return true;
}

/**
 * List all registered plugins.
 */
export function listPlugins(): Array<{
  name: string;
  priority: number;
  enabled: boolean;
  hooks: string[];
}> {
  return _plugins.map((p) => ({
    name: p.name,
    priority: p.priority || 100,
    enabled: p.enabled !== false,
    hooks: [
      p.onRequest ? "onRequest" : "",
      p.onResponse ? "onResponse" : "",
      p.onError ? "onError" : "",
    ].filter(Boolean),
  }));
}

// ── Execution ──

/**
 * Run all onRequest hooks. Returns the (possibly modified) context,
 * or a blocked response if any plugin blocked the request.
 */
export async function runOnRequest(
  ctx: PluginContext
): Promise<{ blocked: boolean; response?: unknown; ctx: PluginContext }> {
  let currentCtx = { ...ctx };

  for (const plugin of _plugins) {
    if (!plugin.enabled || !plugin.onRequest) continue;

    try {
      const result = await plugin.onRequest(currentCtx);
      if (result) {
        if (result.blocked) {
          console.log(`[Plugins] Request blocked by "${plugin.name}"`);
          return { blocked: true, response: result.response, ctx: currentCtx };
        }
        if (result.body) currentCtx.body = result.body as Record<string, unknown>;
        if (result.metadata && typeof result.metadata === "object" && result.metadata !== null) {
          const existingMetadata =
            typeof currentCtx.metadata === "object" && currentCtx.metadata !== null
              ? (currentCtx.metadata as Record<string, unknown>)
              : {};
          currentCtx.metadata = {
            ...existingMetadata,
            ...(result.metadata as Record<string, unknown>),
          } as Record<string, unknown>;
        }
      }
    } catch (err: unknown) {
      console.error(
        `[Plugins] onRequest error in "${plugin.name}": ${err instanceof Error ? err.message : String(err)}`
      );
      // Plugin errors don't block the pipeline by default
    }
  }

  return { blocked: false, ctx: currentCtx };
}

/**
 * Run all onResponse hooks. Returns the (possibly modified) response.
 */
export async function runOnResponse(ctx: PluginContext, response: unknown): Promise<unknown> {
  let currentResponse = response;

  for (const plugin of _plugins) {
    if (!plugin.enabled || !plugin.onResponse) continue;

    try {
      const modified = await plugin.onResponse(ctx, currentResponse);
      if (modified !== undefined && modified !== null) {
        currentResponse = modified;
      }
    } catch (err: unknown) {
      console.error(
        `[Plugins] onResponse error in "${plugin.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return currentResponse;
}

/**
 * Run all onError hooks. Returns a recovery response if any plugin handles it,
 * or null to let the error propagate.
 */
export async function runOnError(ctx: PluginContext, error: Error): Promise<unknown | null> {
  for (const plugin of _plugins) {
    if (!plugin.enabled || !plugin.onError) continue;

    try {
      const recovery = await plugin.onError(ctx, error);
      if (recovery !== undefined && recovery !== null) {
        console.log(`[Plugins] Error recovered by "${plugin.name}"`);
        return recovery;
      }
    } catch (err: unknown) {
      console.error(
        `[Plugins] onError error in "${plugin.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return null; // No recovery — let error propagate
}

/**
 * Reset all plugins (for testing).
 */
export function resetPlugins(): void {
  _plugins.length = 0;
}
