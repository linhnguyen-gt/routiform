import { KIRO_CODEWHISPERER_API, KIRO_Q_API_BASE } from "./kiro-constants.ts";
import { parseResetTime } from "./reset-time.ts";

/**
 * Parse GetUsageLimits JSON (codewhisperer or q.* GET) into dashboard shape.
 * Mirrors 9router open-sse/services/usage.js getKiroUsage.
 */
export function parseKiroGetUsageLimitsPayload(data: Record<string, unknown>) {
  const usageList =
    data.usageBreakdownList || data.UsageBreakdownList || data.usage_breakdown_list || [];
  const list = Array.isArray(usageList) ? usageList : [];
  const quotaInfo: Record<string, unknown> = {};

  const resetAt = parseResetTime(
    data.nextDateReset || data.NextDateReset || data.resetDate || data.ResetDate
  );

  list.forEach((raw: Record<string, unknown>) => {
    const breakdown = raw;
    const resourceType = (breakdown.resourceType || breakdown.ResourceType || "unknown")
      .toString()
      .toLowerCase();
    const used = breakdown.currentUsageWithPrecision ?? breakdown.CurrentUsageWithPrecision ?? 0;
    const total = breakdown.usageLimitWithPrecision ?? breakdown.UsageLimitWithPrecision ?? 0;

    quotaInfo[resourceType] = {
      used,
      total,
      remaining: Number(total) - Number(used),
      resetAt,
      unlimited: false,
    };

    const freeTrial = (breakdown.freeTrialInfo || breakdown.FreeTrialInfo) as Record<
      string,
      unknown
    > | null;
    if (freeTrial && typeof freeTrial === "object") {
      const freeUsed =
        freeTrial.currentUsageWithPrecision ?? freeTrial.CurrentUsageWithPrecision ?? 0;
      const freeTotal = freeTrial.usageLimitWithPrecision ?? freeTrial.UsageLimitWithPrecision ?? 0;
      const ftReset =
        freeTrial.freeTrialExpiry ?? freeTrial.FreeTrialExpiry ?? freeTrial.resetAt ?? resetAt;

      quotaInfo[`${resourceType}_freetrial`] = {
        used: freeUsed,
        total: freeTotal,
        remaining: Number(freeTotal) - Number(freeUsed),
        resetAt: parseResetTime(ftReset) ?? resetAt,
        unlimited: false,
      };
    }
  });

  const plan =
    (data.subscriptionInfo as Record<string, unknown> | undefined)?.subscriptionTitle ||
    (data.SubscriptionInfo as Record<string, unknown> | undefined)?.SubscriptionTitle ||
    "Kiro";

  if (Object.keys(quotaInfo).length === 0) {
    return {
      plan,
      quotas: {},
      message:
        "No usage breakdown in this response. If limits stay empty, reconnect Kiro or set profile ARN on the connection.",
    };
  }

  return {
    plan,
    quotas: quotaInfo,
  };
}

/**
 * Primary: POST codewhisperer JSON-RPC. Fallback: GET q.us-east-1…/getUsageLimits (9router).
 * On 401/403 from primary, return soft message — chat may still work.
 */
export async function getKiroUsageLimitsFromAws(accessToken: string, profileArn: string) {
  const payload = {
    origin: "AI_EDITOR",
    profileArn: profileArn,
    resourceType: "AGENTIC_REQUEST",
  };

  const postResponse = await fetch(KIRO_CODEWHISPERER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-amz-json-1.0",
      "x-amz-target": "AmazonCodeWhispererService.GetUsageLimits",
      Accept: "application/json",
      "x-amzn-codewhisperer-optout": "true",
    },
    body: JSON.stringify(payload),
  });

  if (postResponse.status === 401 || postResponse.status === 403) {
    return {
      plan: "Kiro",
      message: "Kiro quota API authentication expired. Chat may still work.",
      quotas: {},
    };
  }

  if (postResponse.ok) {
    const data = (await postResponse.json()) as Record<string, unknown>;
    return parseKiroGetUsageLimitsPayload(data);
  }

  const errPrimary = await postResponse.text();

  try {
    const params = new URLSearchParams({
      origin: "AI_EDITOR",
      profileArn: String(profileArn),
      resourceType: "AGENTIC_REQUEST",
    });
    const getUrl = `${KIRO_Q_API_BASE}/getUsageLimits?${params.toString()}`;
    const getResponse = await fetch(getUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (getResponse.ok) {
      const data = (await getResponse.json()) as Record<string, unknown>;
      return parseKiroGetUsageLimitsPayload(data);
    }

    const errGet = await getResponse.text();
    throw new Error(
      `Kiro API error (${postResponse.status}): ${errPrimary.slice(0, 400)} | q GET (${getResponse.status}): ${errGet.slice(0, 400)}`
    );
  } catch (fallbackErr) {
    if (fallbackErr instanceof Error && fallbackErr.message.startsWith("Kiro API error")) {
      throw fallbackErr;
    }
    throw new Error(
      `Kiro API error (${postResponse.status}): ${errPrimary.slice(0, 500)} | Fallback: ${(fallbackErr as Error).message}`
    );
  }
}
