import { getGeminiCliPlanLabel } from "./gemini-plan.ts";
import { getGeminiCliSubscriptionInfoCached } from "./gemini-cache.ts";
import { toNumber } from "./json-helpers.ts";
import { parseResetTime } from "./reset-time.ts";
import type { UsageQuota } from "./types.ts";

/**
 * Gemini CLI Usage — fetch per-model quota from Cloud Code Assist API.
 * Gemini CLI and Antigravity share the same upstream (cloudcode-pa.googleapis.com),
 * so this follows the same pattern as getAntigravityUsage().
 */
export async function getGeminiUsage(accessToken, providerSpecificData?, connectionProjectId?) {
  if (!accessToken) {
    return { plan: "Free", message: "Gemini CLI access token not available." };
  }

  try {
    const subscriptionInfo = await getGeminiCliSubscriptionInfoCached(accessToken);
    const projectId =
      connectionProjectId ||
      providerSpecificData?.projectId ||
      subscriptionInfo?.cloudaicompanionProject ||
      null;

    const plan = getGeminiCliPlanLabel(subscriptionInfo);

    if (!projectId) {
      return { plan, message: "Gemini CLI project ID not available." };
    }

    // Use retrieveUserQuota (same endpoint as Gemini CLI /stats command).
    // Returns per-model buckets with remainingFraction and resetTime.
    const response = await fetch(
      "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project: projectId }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      return { plan, message: `Gemini CLI quota error (${response.status}).` };
    }

    const data = await response.json();
    const quotas: Record<string, UsageQuota> = {};

    if (Array.isArray(data.buckets)) {
      for (const bucket of data.buckets) {
        if (!bucket.modelId || bucket.remainingFraction == null) continue;

        const remainingFraction = toNumber(bucket.remainingFraction, 0);
        const remainingPercentage = remainingFraction * 100;
        const QUOTA_NORMALIZED_BASE = 1000;
        const total = QUOTA_NORMALIZED_BASE;
        const remaining = Math.round(total * remainingFraction);
        const used = Math.max(0, total - remaining);

        quotas[bucket.modelId] = {
          used,
          total,
          resetAt: parseResetTime(bucket.resetTime),
          remainingPercentage,
          unlimited: false,
        };
      }
    }

    return { plan, quotas };
  } catch (error) {
    return { message: `Gemini CLI error: ${(error as Error).message}` };
  }
}
