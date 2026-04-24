import { GITHUB_CONFIG } from "./github-constants.ts";
import {
  patchGitHubUnlimitedPairForUi,
  resolveGitHubChatCompletionsQuotas,
  resolveGitHubMonthlyChatCompletions,
  shouldDisplayGitHubQuota,
} from "./github-chat-completions.ts";
import { formatGitHubQuotaSnapshot } from "./github-format-snapshot.ts";
import { inferGitHubPlanName } from "./github-plan.ts";
import { clampPercentage, getFieldValue, toNumber, toRecord } from "./json-helpers.ts";
import { parseResetTime } from "./reset-time.ts";
import type { UsageQuota } from "./types.ts";

/**
 * GitHub Copilot Usage
 * Uses GitHub accessToken (not copilotToken) to call copilot_internal/user API
 */
export async function getGitHubUsage(accessToken, _providerSpecificData) {
  try {
    if (!accessToken) {
      throw new Error("No GitHub access token available. Please re-authorize the connection.");
    }

    // copilot_internal/user API requires GitHub OAuth token, not copilotToken
    const response = await fetch("https://api.github.com/copilot_internal/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/json",
        "X-GitHub-Api-Version": GITHUB_CONFIG.apiVersion,
        "User-Agent": GITHUB_CONFIG.userAgent,
        "Editor-Version": "vscode/1.100.0",
        "Editor-Plugin-Version": "copilot-chat/0.26.7",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 401 || response.status === 403) {
        return {
          message: `GitHub token expired or permission denied. Please re-authenticate the connection.`,
        };
      }
      throw new Error(`GitHub API error: ${error}`);
    }

    const data = await response.json();
    const dataRecord = toRecord(data);

    // Handle different response formats (paid vs free)
    if (dataRecord.quota_snapshots) {
      const snapshots = toRecord(dataRecord.quota_snapshots);
      const resetAt = parseResetTime(
        getFieldValue(dataRecord, "quota_reset_date", "quotaResetDate")
      );
      const premiumQuota = formatGitHubQuotaSnapshot(snapshots.premium_interactions, resetAt);
      const { chat: chatQuota, completions: completionsQuota } = resolveGitHubChatCompletionsQuotas(
        snapshots,
        resetAt
      );
      const quotas: Record<string, UsageQuota> = {};

      if (shouldDisplayGitHubQuota(premiumQuota)) {
        quotas.premium_interactions = premiumQuota;
      }

      const pair: Record<string, UsageQuota> = {};
      if (chatQuota) pair.chat = chatQuota;
      if (completionsQuota) pair.completions = completionsQuota;
      patchGitHubUnlimitedPairForUi(pair);

      if (pair.chat && shouldDisplayGitHubQuota(pair.chat)) {
        quotas.chat = pair.chat;
      }
      if (pair.completions && shouldDisplayGitHubQuota(pair.completions)) {
        quotas.completions = pair.completions;
      }

      return {
        plan: inferGitHubPlanName(dataRecord, premiumQuota),
        resetDate: getFieldValue(dataRecord, "quota_reset_date", "quotaResetDate"),
        quotas,
      };
    } else if (dataRecord.monthly_quotas || dataRecord.limited_user_quotas) {
      // Free/limited plan format
      const { monthly: monthlyQuotas, used: usedQuotas } = resolveGitHubMonthlyChatCompletions(
        toRecord(dataRecord.monthly_quotas),
        toRecord(dataRecord.limited_user_quotas)
      );
      const resetDate = getFieldValue(
        dataRecord,
        "limited_user_reset_date",
        "limitedUserResetDate"
      );
      const resetAt = parseResetTime(resetDate);
      const quotas: Record<string, UsageQuota> = {};

      const addLimitedQuota = (apiKey: string, outputKey: string) => {
        const total = toNumber(getFieldValue(monthlyQuotas, apiKey, apiKey), 0);
        const used = Math.max(0, toNumber(getFieldValue(usedQuotas, apiKey, apiKey), 0));
        if (total <= 0) return null;
        const clampedUsed = Math.min(used, total);
        quotas[outputKey] = {
          used: clampedUsed,
          total,
          remaining: Math.max(total - clampedUsed, 0),
          remainingPercentage: clampPercentage(((total - clampedUsed) / total) * 100),
          unlimited: false,
          resetAt,
        };
        return quotas[outputKey];
      };

      const premiumQuota = addLimitedQuota("premium_interactions", "premium_interactions");
      addLimitedQuota("chat", "chat");
      addLimitedQuota("completions", "completions");

      patchGitHubUnlimitedPairForUi(quotas);

      return {
        plan: inferGitHubPlanName(dataRecord, premiumQuota),
        resetDate,
        quotas,
      };
    }

    return { message: "GitHub Copilot connected. Unable to parse quota data." };
  } catch (error) {
    throw new Error(`Failed to fetch GitHub usage: ${error.message}`);
  }
}
