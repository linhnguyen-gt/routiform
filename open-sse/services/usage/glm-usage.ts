import { toNumber, toRecord } from "./json-helpers.ts";
import type { UsageQuota } from "./types.ts";

const GLM_QUOTA_URLS: Record<string, string> = {
  international: "https://api.z.ai/api/monitor/usage/quota/limit",
  china: "https://open.bigmodel.cn/api/monitor/usage/quota/limit",
};

export async function getGlmUsage(apiKey: string, providerSpecificData?: Record<string, unknown>) {
  const rawRegion = providerSpecificData?.apiRegion;
  const region = typeof rawRegion === "string" ? rawRegion : "international";
  const quotaUrl = GLM_QUOTA_URLS[region] || GLM_QUOTA_URLS.international;

  const res = await fetch(quotaUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid API key");
    throw new Error(`GLM quota API error (${res.status})`);
  }

  const json = await res.json();
  const data = toRecord(json.data);
  const limits: unknown[] = Array.isArray(data.limits) ? data.limits : [];
  const quotas: Record<string, UsageQuota> = {};

  for (const limit of limits) {
    const src = toRecord(limit);
    if (src.type !== "TOKENS_LIMIT") continue;

    const usedPercent = toNumber(src.percentage, 0);
    const resetMs = toNumber(src.nextResetTime, 0);
    const remaining = Math.max(0, 100 - usedPercent);

    quotas["session"] = {
      used: usedPercent,
      total: 100,
      remaining,
      remainingPercentage: remaining,
      resetAt: resetMs > 0 ? new Date(resetMs).toISOString() : null,
      unlimited: false,
    };
  }

  const levelRaw = typeof data.level === "string" ? data.level : "";
  const plan = levelRaw
    ? levelRaw.charAt(0).toUpperCase() + levelRaw.slice(1).toLowerCase()
    : "Unknown";

  return { plan, quotas };
}
