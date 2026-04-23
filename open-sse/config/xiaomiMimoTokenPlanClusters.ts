/** Xiaomi MiMo Token Plan — cluster roots (no /v1 or /anthropic; protocol chosen at chat time). */
export const XIAOMI_MIMO_TOKEN_PLAN_CLUSTERS = [
  { id: "cn", label: "China Cluster", baseUrl: "https://token-plan-cn.xiaomimimo.com" },
  { id: "sgp", label: "Singapore Cluster", baseUrl: "https://token-plan-sgp.xiaomimimo.com" },
  { id: "ams", label: "Europe Cluster", baseUrl: "https://token-plan-ams.xiaomimimo.com" },
] as const;

export type XiaomiMimoTokenPlanClusterId = (typeof XIAOMI_MIMO_TOKEN_PLAN_CLUSTERS)[number]["id"];

/** Strip legacy full subscription URLs down to cluster root. */
export function normalizeXiaomiTokenPlanClusterBaseUrl(raw: string): string {
  let u = String(raw || "")
    .trim()
    .replace(/\/+$/, "");
  if (!u) return "";
  if (/\/v1$/i.test(u)) u = u.replace(/\/v1$/i, "");
  if (/\/anthropic$/i.test(u)) u = u.replace(/\/anthropic$/i, "");
  return u.replace(/\/+$/, "");
}

export function buildXiaomiTokenPlanOpenAiModelsUrl(clusterRoot: string): string {
  const root = normalizeXiaomiTokenPlanClusterBaseUrl(clusterRoot);
  if (!root) return "";
  return `${root}/v1/models`;
}
