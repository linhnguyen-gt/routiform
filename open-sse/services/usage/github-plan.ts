import { getFieldValue, toNumber, toRecord } from "./json-helpers.ts";
import type { JsonRecord } from "./types.ts";
import type { UsageQuota } from "./types.ts";

function toDisplayLabel(value: string): string {
  return value
    .replace(/^copilot[_\s-]*/i, "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^pro\+$/i.test(part)) return "Pro+";
      if (/^[a-z]{2,}$/.test(part))
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      return part;
    })
    .join(" ")
    .trim();
}

export function inferGitHubPlanName(data: JsonRecord, premiumQuota: UsageQuota | null): string {
  const rawPlan = getFieldValue(data, "copilot_plan", "copilotPlan");
  const rawSku = getFieldValue(data, "access_type_sku", "accessTypeSku");
  const planText = typeof rawPlan === "string" ? rawPlan.trim() : "";
  const skuText = typeof rawSku === "string" ? rawSku.trim() : "";
  const combined = `${skuText} ${planText}`.trim().toUpperCase();
  const monthlyQuotas = toRecord(getFieldValue(data, "monthly_quotas", "monthlyQuotas"));
  const premiumTotal =
    premiumQuota?.total ||
    toNumber(getFieldValue(monthlyQuotas, "premium_interactions", "premiumInteractions"), 0);
  const chatTotal = toNumber(getFieldValue(monthlyQuotas, "chat", "chat"), 0);

  if (combined.includes("PRO+") || combined.includes("PRO_PLUS") || combined.includes("PROPLUS")) {
    return "Copilot Pro+";
  }
  if (combined.includes("ENTERPRISE")) return "Copilot Enterprise";
  if (combined.includes("BUSINESS")) return "Copilot Business";
  if (combined.includes("STUDENT")) return "Copilot Student";
  if (combined.includes("FREE")) return "Copilot Free";
  if (combined.includes("PRO")) return "Copilot Pro";

  if (premiumTotal >= 1400) return "Copilot Pro+";
  if (premiumTotal >= 900) return "Copilot Enterprise";
  if (premiumTotal >= 250) {
    if (combined.includes("INDIVIDUAL")) return "Copilot Pro";
    return "Copilot Business";
  }
  if (premiumTotal > 0 || chatTotal === 50) return "Copilot Free";

  if (skuText) {
    const label = toDisplayLabel(skuText);
    return label ? `Copilot ${label}` : "GitHub Copilot";
  }
  if (planText) {
    const label = toDisplayLabel(planText);
    return label ? `Copilot ${label}` : "GitHub Copilot";
  }
  return "GitHub Copilot";
}
