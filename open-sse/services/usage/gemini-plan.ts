/**
 * Map Gemini CLI subscription tier to display label (same tiers as Antigravity).
 */
export function getGeminiCliPlanLabel(subscriptionInfo) {
  if (!subscriptionInfo || Object.keys(subscriptionInfo).length === 0) return "Free";

  let tierId = "";
  if (Array.isArray(subscriptionInfo.allowedTiers)) {
    for (const tier of subscriptionInfo.allowedTiers) {
      if (tier.isDefault && tier.id) {
        tierId = tier.id.trim().toUpperCase();
        break;
      }
    }
  }

  if (!tierId) {
    tierId = (subscriptionInfo.currentTier?.id || "").toUpperCase();
  }

  if (tierId) {
    if (tierId.includes("ULTRA")) return "Ultra";
    if (tierId.includes("PRO")) return "Pro";
    if (tierId.includes("ENTERPRISE")) return "Enterprise";
    if (tierId.includes("BUSINESS") || tierId.includes("STANDARD")) return "Business";
    if (tierId.includes("FREE") || tierId.includes("INDIVIDUAL") || tierId.includes("LEGACY"))
      return "Free";
  }

  const tierName =
    subscriptionInfo.currentTier?.name ||
    subscriptionInfo.currentTier?.displayName ||
    subscriptionInfo.subscriptionType ||
    subscriptionInfo.tier ||
    "";
  const upper = tierName.toUpperCase();

  if (upper.includes("ULTRA")) return "Ultra";
  if (upper.includes("PRO")) return "Pro";
  if (upper.includes("ENTERPRISE")) return "Enterprise";
  if (upper.includes("STANDARD") || upper.includes("BUSINESS")) return "Business";
  if (upper.includes("INDIVIDUAL") || upper.includes("FREE")) return "Free";

  if (subscriptionInfo.currentTier?.upgradeSubscriptionType) return "Free";
  if (tierName) {
    return tierName.charAt(0).toUpperCase() + tierName.slice(1).toLowerCase();
  }

  return "Free";
}
