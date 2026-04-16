import { getUpstreamProxyConfig } from "@/lib/localDb";
import { getExecutor } from "../../executors/index.ts";
import type { ProviderExecutor, ResolveExecutorWithProxyOptions } from "../types/chat-core.ts";

interface UpstreamProxyConfig {
  mode: string;
  enabled: boolean;
}

const proxyConfigCache = new Map<string, { mode: string; enabled: boolean; ts: number }>();
const PROXY_CONFIG_CACHE_TTL = 10_000;

function isRetryableStatus(status: number) {
  return status >= 500 || status === 429 || status === 0;
}

async function getUpstreamProxyConfigCached(providerId: string): Promise<UpstreamProxyConfig> {
  const cached = proxyConfigCache.get(providerId);
  if (cached && Date.now() - cached.ts < PROXY_CONFIG_CACHE_TTL) return cached;
  const cfg = await getUpstreamProxyConfig(providerId).catch(() => null);
  const result = cfg
    ? { mode: cfg.mode, enabled: cfg.enabled, ts: Date.now() }
    : { mode: "native" as const, enabled: false, ts: Date.now() };
  proxyConfigCache.set(providerId, result);
  return result;
}

export async function resolveExecutorWithProxy({
  provider,
  log,
}: ResolveExecutorWithProxyOptions): Promise<ProviderExecutor> {
  const cfg = await getUpstreamProxyConfigCached(provider);
  if (!cfg.enabled || cfg.mode === "native") return getExecutor(provider);

  if (cfg.mode === "cliproxyapi") {
    log?.info?.("UPSTREAM_PROXY", `${provider} routed through CLIProxyAPI (passthrough)`);
    return getExecutor("cliproxyapi");
  }

  const nativeExec = getExecutor(provider);
  const proxyExec = getExecutor("cliproxyapi");
  const wrapper = Object.create(nativeExec) as ProviderExecutor;

  wrapper.execute = async (input) => {
    try {
      const result = await nativeExec.execute(input);
      if (isRetryableStatus(result.response.status)) {
        log?.info?.(
          "UPSTREAM_PROXY",
          `${provider} native failed (${result.response.status}), retrying via CLIProxyAPI`
        );
        try {
          return await proxyExec.execute(input);
        } catch (proxyErr) {
          const proxyMsg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
          log?.error?.(
            "UPSTREAM_PROXY",
            `${provider} CLIProxyAPI fallback also failed: ${proxyMsg}`
          );
          throw proxyErr;
        }
      }
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log?.info?.(
        "UPSTREAM_PROXY",
        `${provider} native error (${errMsg}), retrying via CLIProxyAPI`
      );
      try {
        return await proxyExec.execute(input);
      } catch (proxyErr) {
        const proxyMsg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
        log?.error?.("UPSTREAM_PROXY", `${provider} CLIProxyAPI fallback also failed: ${proxyMsg}`);
        throw proxyErr;
      }
    }
  };

  return wrapper;
}
