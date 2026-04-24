import {
  ANTIGRAVITY_CONFIG,
  ANTIGRAVITY_EXCLUDED_MODELS,
  getAntigravityApiUserAgent,
} from "./antigravity-config.ts";
import { getFieldValue, toNumber, toRecord } from "./json-helpers.ts";
import { parseResetTime } from "./reset-time.ts";
import type { JsonRecord } from "./types.ts";
import type { UsageQuota } from "./types.ts";

/**
 * Remaining fraction 0..1 from quotaInfo; supports camelCase + snake_case, 0–100 scale,
 * usedFraction, and percentage fields some API revisions send.
 */
function resolveAntigravityRemainingFraction(quotaInfo: JsonRecord): number {
  let raw = toNumber(getFieldValue(quotaInfo, "remaining_fraction", "remainingFraction"), -1);
  if (raw >= 0 && raw <= 1) return raw;
  if (raw > 1 && raw <= 100) return raw / 100;

  const usedFrac = toNumber(getFieldValue(quotaInfo, "used_fraction", "usedFraction"), -1);
  if (usedFrac >= 0 && usedFrac <= 1) return 1 - usedFrac;

  const remPct = toNumber(
    getFieldValue(quotaInfo, "remaining_percentage", "remainingPercentage"),
    -1
  );
  if (remPct >= 0 && remPct <= 100) return remPct / 100;

  const usedPct = toNumber(getFieldValue(quotaInfo, "used_percentage", "usedPercentage"), -1);
  if (usedPct >= 0 && usedPct <= 100) return (100 - usedPct) / 100;

  return -1;
}

export function pushAntigravityModelQuota(
  modelKey: string,
  quotaInfo: JsonRecord,
  quotas: Record<string, UsageQuota>
): void {
  const rawFraction = resolveAntigravityRemainingFraction(quotaInfo);
  const resetRaw = getFieldValue(quotaInfo, "reset_time", "resetTime");
  const resetAt = parseResetTime(resetRaw);
  const explicitUnlimited =
    quotaInfo.unlimited === true ||
    quotaInfo.unlimited === "true" ||
    getFieldValue(quotaInfo, "is_unlimited", "isUnlimited") === true;

  let remainingFraction: number;
  if (rawFraction >= 0) {
    remainingFraction = Math.min(1, Math.max(0, rawFraction));
  } else if (explicitUnlimited) {
    remainingFraction = 1;
  } else {
    // Unknown fraction: do NOT default to 100% — that masks exhausted quota when field names differ.
    remainingFraction = 0;
  }

  const isUnlimited = explicitUnlimited || (!resetAt && rawFraction >= 0 && remainingFraction >= 1);
  const remainingPercentage = remainingFraction * 100;
  const QUOTA_NORMALIZED_BASE = 1000;
  const total = QUOTA_NORMALIZED_BASE;
  const remaining = Math.round(total * remainingFraction);
  const used = isUnlimited ? 0 : Math.max(0, total - remaining);

  quotas[modelKey] = {
    used,
    total: isUnlimited ? 0 : total,
    resetAt,
    remainingPercentage: isUnlimited ? 100 : remainingPercentage,
    unlimited: isUnlimited,
  };
}

/**
 * Merge Gemini quota buckets from retrieveUserQuota (authoritative for Gemini models)
 * over fetchAvailableModels entries when projectId is known.
 */
export async function mergeAntigravityRetrieveUserQuota(
  accessToken: string,
  projectId: string,
  quotas: Record<string, UsageQuota>
): Promise<void> {
  const fb = await fetch(ANTIGRAVITY_CONFIG.retrieveUserQuotaUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": getAntigravityApiUserAgent(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ project: projectId }),
    signal: AbortSignal.timeout(10000),
  });

  if (!fb.ok) return;

  const fbJson = await fb.json();
  const fbRec = toRecord(fbJson);
  const buckets = Array.isArray(fbRec.buckets) ? fbRec.buckets : [];

  for (const bucket of buckets) {
    const b = toRecord(bucket);
    const idRaw = getFieldValue(b, "model_id", "modelId");
    const modelKey = typeof idRaw === "string" ? idRaw : "";
    if (!modelKey || ANTIGRAVITY_EXCLUDED_MODELS.has(modelKey)) continue;

    let remFrac = toNumber(getFieldValue(b, "remaining_fraction", "remainingFraction"), -1);
    if (remFrac < 0) {
      const usedFrac = toNumber(getFieldValue(b, "used_fraction", "usedFraction"), -1);
      if (usedFrac >= 0 && usedFrac <= 1) remFrac = 1 - usedFrac;
    }
    if (remFrac < 0) continue;

    const quotaInfo: JsonRecord = {
      remainingFraction: remFrac,
      resetTime: getFieldValue(b, "reset_time", "resetTime"),
    };
    pushAntigravityModelQuota(modelKey, quotaInfo, quotas);
  }
}
