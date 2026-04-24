import { clampPercentage, getFieldValue, toNumber, toRecord } from "./json-helpers.ts";
import type { UsageQuota } from "./types.ts";

export function formatGitHubQuotaSnapshot(quota, resetAt: string | null = null): UsageQuota | null {
  const source = toRecord(quota);
  if (Object.keys(source).length === 0) return null;

  const unlimited = source.unlimited === true;
  const entitlement = toNumber(source.entitlement, Number.NaN);
  const totalValue = toNumber(source.total, Number.NaN);
  const remainingValue = toNumber(source.remaining, Number.NaN);
  const usedValue = toNumber(source.used, Number.NaN);
  const percentRemainingValue = toNumber(
    getFieldValue(source, "percent_remaining", "percentRemaining"),
    Number.NaN
  );
  const percentUsedValue = toNumber(
    getFieldValue(source, "percent_used", "percentUsed"),
    Number.NaN
  );

  // Same as 9router: used = entitlement − remaining; never trust percent_* when counts exist.
  if (
    Number.isFinite(entitlement) &&
    entitlement > 0 &&
    Number.isFinite(remainingValue) &&
    remainingValue >= 0
  ) {
    const total = Math.max(0, entitlement);
    const remaining = Math.min(total, Math.max(0, remainingValue));
    const used = Math.max(0, total - remaining);
    const remainingPercentage = clampPercentage((remaining / total) * 100);
    return {
      used,
      total,
      remaining,
      remainingPercentage,
      resetAt,
      unlimited,
    };
  }

  let total = Number.isFinite(totalValue)
    ? Math.max(0, totalValue)
    : Number.isFinite(entitlement)
      ? Math.max(0, entitlement)
      : 0;
  let remaining = Number.isFinite(remainingValue) ? Math.max(0, remainingValue) : undefined;
  let used = Number.isFinite(usedValue) ? Math.max(0, usedValue) : undefined;

  if (used === undefined && total > 0 && remaining !== undefined) {
    used = Math.max(total - remaining, 0);
  }

  if (remaining === undefined && total > 0 && used !== undefined) {
    remaining = Math.max(total - used, 0);
  }

  let remainingPercentage: number | undefined;
  if (total > 0 && remaining !== undefined) {
    remainingPercentage = clampPercentage((remaining / total) * 100);
  } else if (total > 0 && used !== undefined) {
    remainingPercentage = clampPercentage(((total - used) / total) * 100);
  } else if (Number.isFinite(percentUsedValue)) {
    remainingPercentage = clampPercentage(100 - clampPercentage(percentUsedValue));
  } else if (Number.isFinite(percentRemainingValue)) {
    let p = percentRemainingValue;
    if (p > 0 && p <= 1) {
      p = p * 100;
    }
    remainingPercentage = clampPercentage(p);
  }

  if (total <= 0 && remainingPercentage !== undefined) {
    total = 100;
    used = 100 - remainingPercentage;
    remaining = remainingPercentage;
  }

  if (unlimited && total <= 0 && remainingPercentage === undefined) {
    return {
      used: 0,
      total: 0,
      remaining: undefined,
      remainingPercentage: undefined,
      resetAt,
      unlimited: true,
    };
  }

  return {
    used: Math.max(0, used ?? 0),
    total,
    remaining,
    remainingPercentage,
    resetAt,
    unlimited,
  };
}
