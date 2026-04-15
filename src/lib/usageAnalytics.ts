/**
 * Usage Analytics — Aggregation functions for the analytics dashboard
 *
 * Processes usage.json history entries into dashboard-ready data:
 * summary cards, daily trends, activity heatmap, model breakdown, etc.
 */

import { computeCostFromPricing, normalizeModelName } from "@/lib/usage/costCalculator";

/**
 * Compute date range boundaries
 * @param {string} range - "1d" | "7d" | "30d" | "90d" | "ytd" | "all"
 * @returns {{ start: Date, end: Date }}
 */
function getDateRange(range: string) {
  const end = new Date();
  let start;

  switch (range) {
    case "1d":
      start = new Date(end);
      start.setDate(start.getDate() - 1);
      break;
    case "7d":
      start = new Date(end);
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start = new Date(end);
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start = new Date(end);
      start.setDate(start.getDate() - 90);
      break;
    case "ytd":
      start = new Date(end.getFullYear(), 0, 1);
      break;
    case "all":
    default:
      start = new Date(0);
      break;
  }

  return { start, end };
}

/**
 * Format a Date to "YYYY-MM-DD" string
 */
function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Short model name (strip provider prefix paths)
 */
function shortModelName(model: string) {
  if (!model) return "unknown";
  // "accounts/fireworks/models/gpt-oss-120b" → "gpt-oss-120b"
  const parts = model.split("/");
  return parts[parts.length - 1] || model;
}

/**
 * Compute all analytics data from usage history
 * @param {Array} history - Array of usage entries
 * @param {string} range - Time range filter
 * @param {Object} connectionMap - Map of connectionId → account name
 * @returns {Object} Analytics data
 */
export async function computeAnalytics(
  history: unknown[],
  range = "30d",
  connectionMap: Record<string, string> = {}
) {
  const { start, end } = getDateRange(range);

  // ---- Filtered entries ----
  const entries = history.filter((e) => {
    const entry = e as Record<string, unknown>;
    const t = new Date(entry.timestamp as string | number | Date);
    return t >= start && t <= end;
  });

  // ---- Summary ----
  const summary = {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalCost: 0,
    totalRequests: entries.length,
    uniqueModels: new Set<string>(),
    uniqueAccounts: new Set<string>(),
    uniqueApiKeys: new Set<string>(),
  };

  // ---- Daily trend ----
  const dailyMap: Record<string, Record<string, unknown>> = {}; // "YYYY-MM-DD" → { requests, promptTokens, completionTokens, cost }
  const dailyByModelMap: Record<string, Record<string, number>> = {}; // "YYYY-MM-DD" → { modelShort → tokens }

  // ---- Activity heatmap (always last 365 days, regardless of range filter) ----
  const heatmapStart = new Date();
  heatmapStart.setDate(heatmapStart.getDate() - 364);
  const activityMap: Record<string, number> = {};

  // ---- By model / account / provider ----
  const byModelMap: Record<string, Record<string, unknown>> = {};
  const byAccountMap: Record<string, Record<string, unknown>> = {};
  const byProviderMap: Record<string, Record<string, unknown>> = {};
  const byApiKeyMap: Record<string, Record<string, unknown>> = {};

  // ---- Weekly pattern (0=Sun..6=Sat) ----
  const weeklyTokens = [0, 0, 0, 0, 0, 0, 0];
  const weeklyCounts = [0, 0, 0, 0, 0, 0, 0];

  // ---- Single pass over ALL history for heatmap ----
  for (const entry of history) {
    const entryObj = entry as Record<string, unknown>;
    const entryDate = new Date(entryObj.timestamp as string | number | Date);
    if (entryDate >= heatmapStart) {
      const key = toDateKey(entryDate);
      const tokens = entryObj.tokens as Record<string, unknown> | undefined;
      const inputTokens = tokens?.input ?? tokens?.prompt_tokens ?? 0;
      const outputTokens = tokens?.output ?? tokens?.completion_tokens ?? 0;
      const totalTokens = (inputTokens as number) + (outputTokens as number);
      activityMap[key] = (activityMap[key] || 0) + totalTokens;
    }
  }

  // ---- Single pass over filtered entries for everything else ----
  const pricingByPair = new Map<string, unknown>();
  const pricingPairs = new Map<string, { provider: string; model: string }>();

  for (const entry of entries) {
    const entryObj = entry as Record<string, unknown>;
    if (!entryObj?.provider || !entryObj?.model) continue;
    const pairKey = `${entryObj.provider}::${entryObj.model}`;
    if (!pricingPairs.has(pairKey)) {
      pricingPairs.set(pairKey, {
        provider: String(entryObj.provider),
        model: String(entryObj.model),
      });
    }
  }

  if (pricingPairs.size > 0) {
    try {
      const { getPricingForModel } = await import("@/lib/localDb");
      await Promise.all(
        Array.from(pricingPairs.entries()).map(async ([pairKey, pair]) => {
          let pricing = await getPricingForModel(pair.provider, pair.model);
          if (!pricing) {
            const normalizedModel = normalizeModelName(pair.model);
            if (normalizedModel && normalizedModel !== pair.model) {
              pricing = await getPricingForModel(pair.provider, normalizedModel);
            }
          }
          pricingByPair.set(pairKey, pricing || null);
        })
      );
    } catch {
      // If pricing prefetch fails, costs fall back to 0 below.
    }
  }

  for (const entry of entries) {
    const entryObj = entry as Record<string, unknown>;
    const tokens = entryObj.tokens as Record<string, unknown> | undefined;
    const pt = (tokens?.input ?? tokens?.prompt_tokens ?? 0) as number;
    const ct = (tokens?.output ?? tokens?.completion_tokens ?? 0) as number;
    const totalTkns = pt + ct;
    const entryDate = new Date(entryObj.timestamp as string | number | Date);
    const dateKey = toDateKey(entryDate);
    const dayOfWeek = entryDate.getDay();
    const modelShort = shortModelName(String(entryObj.model || ""));

    // Cost
    const pairKey = `${entryObj.provider}::${entryObj.model}`;
    const pricing = pricingByPair.get(pairKey) ?? null;
    const cost = computeCostFromPricing(pricing, tokens);

    // Summary
    summary.promptTokens += pt;
    summary.completionTokens += ct;
    summary.totalTokens += totalTkns;
    summary.totalCost += cost;
    if (entryObj.model) summary.uniqueModels.add(modelShort);
    if (entryObj.connectionId) summary.uniqueAccounts.add(String(entryObj.connectionId));
    if (entryObj.apiKeyId || entryObj.apiKeyName) {
      summary.uniqueApiKeys.add(String(entryObj.apiKeyId || entryObj.apiKeyName));
    }

    // Daily trend
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        date: dateKey,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
      };
    }
    const dailyEntry = dailyMap[dateKey];
    (dailyEntry.requests as number)++;
    (dailyEntry.promptTokens as number) += pt;
    (dailyEntry.completionTokens as number) += ct;
    (dailyEntry.cost as number) += cost;

    // Daily by model
    if (!dailyByModelMap[dateKey]) dailyByModelMap[dateKey] = {};
    dailyByModelMap[dateKey][modelShort] = (dailyByModelMap[dateKey][modelShort] || 0) + totalTkns;

    // Weekly pattern
    weeklyTokens[dayOfWeek] += totalTkns;
    weeklyCounts[dayOfWeek]++;

    // By model
    if (!byModelMap[modelShort]) {
      byModelMap[modelShort] = {
        model: modelShort,
        provider: entryObj.provider,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
      };
    }
    const modelEntry = byModelMap[modelShort];
    (modelEntry.requests as number)++;
    (modelEntry.promptTokens as number) += pt;
    (modelEntry.completionTokens as number) += ct;
    (modelEntry.totalTokens as number) += totalTkns;
    (modelEntry.cost as number) += cost;

    // By account
    const accountName = entryObj.connectionId
      ? connectionMap[String(entryObj.connectionId)] ||
        `Account ${String(entryObj.connectionId).slice(0, 8)}`
      : String(entryObj.provider || "unknown");
    if (!byAccountMap[accountName]) {
      byAccountMap[accountName] = { account: accountName, totalTokens: 0, requests: 0, cost: 0 };
    }
    const accountEntry = byAccountMap[accountName];
    (accountEntry.totalTokens as number) += totalTkns;
    (accountEntry.requests as number)++;
    (accountEntry.cost as number) += cost;

    // By provider
    const prov = String(entryObj.provider || "unknown");
    if (!byProviderMap[prov]) {
      byProviderMap[prov] = {
        provider: prov,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
      };
    }
    const provEntry = byProviderMap[prov];
    (provEntry.requests as number)++;
    (provEntry.promptTokens as number) += pt;
    (provEntry.completionTokens as number) += ct;
    (provEntry.totalTokens as number) += totalTkns;
    (provEntry.cost as number) += cost;

    // By API key
    if (entryObj.apiKeyId || entryObj.apiKeyName) {
      const keyName = String(entryObj.apiKeyName || entryObj.apiKeyId || "unknown");
      const keyLabel = entryObj.apiKeyId ? `${keyName} (${entryObj.apiKeyId})` : keyName;
      if (!byApiKeyMap[keyLabel]) {
        byApiKeyMap[keyLabel] = {
          apiKey: keyLabel,
          apiKeyId: entryObj.apiKeyId || null,
          apiKeyName: keyName,
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        };
      }
      const keyEntry = byApiKeyMap[keyLabel];
      (keyEntry.requests as number)++;
      (keyEntry.promptTokens as number) += pt;
      (keyEntry.completionTokens as number) += ct;
      (keyEntry.totalTokens as number) += totalTkns;
      (keyEntry.cost as number) += cost;
    }
  }

  // ---- Build sorted arrays ----
  const dailyTrend = Object.values(dailyMap).sort((a, b) => {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    return String(aObj.date).localeCompare(String(bObj.date));
  });

  // Daily by model — collect all unique model names
  const allModels = new Set<string>();
  for (const day of Object.values(dailyByModelMap)) {
    for (const m of Object.keys(day)) allModels.add(m);
  }
  const dailyByModel = dailyTrend.map((d) => {
    const dObj = d as Record<string, unknown>;
    const row: Record<string, unknown> = { date: dObj.date };
    for (const m of allModels) {
      row[m] = dailyByModelMap[String(dObj.date)]?.[m] || 0;
    }
    return row;
  });

  const byModel = Object.values(byModelMap)
    .sort((a, b) => {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      return (bObj.totalTokens as number) - (aObj.totalTokens as number);
    })
    .map((m) => {
      const mObj = m as Record<string, unknown>;
      return {
        ...mObj,
        pct:
          summary.totalTokens > 0
            ? (((mObj.totalTokens as number) / summary.totalTokens) * 100).toFixed(1)
            : "0",
      };
    });

  const byAccount = Object.values(byAccountMap).sort((a, b) => {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    return (bObj.totalTokens as number) - (aObj.totalTokens as number);
  });
  const byProvider = Object.values(byProviderMap).sort((a, b) => {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    return (bObj.totalTokens as number) - (aObj.totalTokens as number);
  });
  const byApiKey = Object.values(byApiKeyMap).sort((a, b) => {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    return (bObj.totalTokens as number) - (aObj.totalTokens as number);
  });

  // Weekly pattern (avg tokens per day of week)
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyPattern = weekDays.map((name, i) => ({
    day: name,
    avgTokens: weeklyCounts[i] > 0 ? Math.round(weeklyTokens[i] / weeklyCounts[i]) : 0,
    totalTokens: weeklyTokens[i],
  }));

  // Streak — consecutive days with activity (from today going back)
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    if (activityMap[key] && activityMap[key] > 0) {
      streak++;
    } else if (i > 0) {
      break; // Stop at first gap (skip today if no activity yet)
    }
  }

  return {
    summary: {
      totalTokens: summary.totalTokens,
      promptTokens: summary.promptTokens,
      completionTokens: summary.completionTokens,
      totalCost: summary.totalCost,
      totalRequests: summary.totalRequests,
      uniqueModels: summary.uniqueModels.size,
      uniqueAccounts: summary.uniqueAccounts.size,
      uniqueApiKeys: summary.uniqueApiKeys.size,
      streak,
    },
    dailyTrend,
    dailyByModel,
    modelNames: [...allModels],
    byModel,
    byAccount,
    byProvider,
    byApiKey,
    activityMap,
    weeklyPattern,
    range,
  };
}
