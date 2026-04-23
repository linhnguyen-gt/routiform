import { buildXiaomiTokenPlanOpenAiModelsUrl } from "@routiform/open-sse/config/xiaomiMimoTokenPlanClusters.ts";

/** Models catalog for dashboard: always OpenAI-style list on the cluster (same key). */
export function buildXiaomiMimoTokenPlanModelsUrl(clusterRoot: string): string {
  return buildXiaomiTokenPlanOpenAiModelsUrl(clusterRoot);
}
