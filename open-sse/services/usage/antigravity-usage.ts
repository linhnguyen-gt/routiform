import {
  ANTIGRAVITY_CONFIG,
  ANTIGRAVITY_EXCLUDED_MODELS,
  getAntigravityApiUserAgent,
} from "./antigravity-config.ts";
import { getAntigravityPlanLabel } from "./antigravity-plan.ts";
import {
  mergeAntigravityRetrieveUserQuota,
  pushAntigravityModelQuota,
} from "./antigravity-quota-merge.ts";
import { getAntigravitySubscriptionInfoCached } from "./antigravity-subscription.ts";
import { toRecord } from "./json-helpers.ts";
import type { UsageQuota } from "./types.ts";

/**
 * Antigravity Usage - Fetch quota from Google Cloud Code API
 * Uses fetchAvailableModels API which returns ALL models (including Claude)
 * with per-model quotaInfo (remainingFraction, resetTime).
 * retrieveUserQuota only returns Gemini models — not suitable for Antigravity.
 */
export async function getAntigravityUsage(accessToken, _providerSpecificData) {
  try {
    const subscriptionInfo = await getAntigravitySubscriptionInfoCached(accessToken);
    const projectId = subscriptionInfo?.cloudaicompanionProject || null;

    // Fetch model list with quota info from fetchAvailableModels
    const response = await fetch(ANTIGRAVITY_CONFIG.quotaApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": getAntigravityApiUserAgent(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(projectId ? { project: projectId } : {}),
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 403) {
      return { message: "Antigravity access forbidden. Check subscription." };
    }

    if (!response.ok) {
      throw new Error(`Antigravity API error: ${response.status}`);
    }

    const data = await response.json();
    const dataObj = toRecord(data);
    const modelEntries = toRecord(dataObj.models);
    const quotas: Record<string, UsageQuota> = {};

    // Parse per-model quota info from fetchAvailableModels response.
    for (const [modelKey, infoValue] of Object.entries(modelEntries)) {
      const info = toRecord(infoValue);
      const quotaInfo = toRecord(info.quotaInfo);

      // Skip internal, excluded, and models without quota info
      if (
        info.isInternal === true ||
        ANTIGRAVITY_EXCLUDED_MODELS.has(modelKey) ||
        Object.keys(quotaInfo).length === 0
      ) {
        continue;
      }

      pushAntigravityModelQuota(modelKey, quotaInfo, quotas);
    }

    // retrieveUserQuota is the same source as Gemini CLI /stats — always merge when we have
    // a project so Gemini-family buckets override fetchAvailableModels (often more accurate).
    // Claude-only quotas still come from fetchAvailableModels above.
    if (projectId) {
      try {
        await mergeAntigravityRetrieveUserQuota(accessToken, projectId, quotas);
      } catch {
        /* ignore */
      }
    }

    return {
      plan: getAntigravityPlanLabel(subscriptionInfo),
      quotas,
      subscriptionInfo,
    };
  } catch (error) {
    return { message: `Antigravity error: ${(error as Error).message}` };
  }
}
