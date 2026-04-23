import type { ProviderModelsConfigEntry } from "./provider-models-config-types";
import { providerModelsConfigPartA } from "./provider-models-config-part-a";
import { providerModelsConfigPartB1 } from "./provider-models-config-part-b1";
import { providerModelsConfigPartB2 } from "./provider-models-config-part-b2";

export const PROVIDER_MODELS_CONFIG: Record<string, ProviderModelsConfigEntry> = {
  ...providerModelsConfigPartA,
  ...providerModelsConfigPartB1,
  ...providerModelsConfigPartB2,
};
