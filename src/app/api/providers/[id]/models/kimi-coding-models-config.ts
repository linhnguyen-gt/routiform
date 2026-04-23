import { asRecord } from "./json-utils";
import type { ProviderModelsConfigEntry } from "./provider-models-config-types";

export const KIMI_CODING_MODELS_CONFIG: ProviderModelsConfigEntry = {
  url: "https://api.moonshot.ai/v1/models",
  method: "GET",
  headers: { "Content-Type": "application/json" },
  authHeader: "Authorization",
  authPrefix: "Bearer ",
  parseResponse: (data) => {
    const record = asRecord(data);
    return (record.data as unknown[]) || (record.models as unknown[]) || [];
  },
};
