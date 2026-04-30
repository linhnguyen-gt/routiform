import { validateQoderCliPat } from "@routiform/open-sse/services/qoderCli.ts";
import type { JsonRecord } from "./constants";
import {
  validateAssemblyAIProvider,
  validateDeepgramProvider,
  validateElevenLabsProvider,
  validateInworldProvider,
  validateNanoBananaProvider,
} from "./specialty-audio-media";
import { validateBailianCodingPlanProvider } from "./specialty-bailian";
import {
  validateLongcatProvider,
  validateNvidiaProvider,
  validateXiaomiMimoTokenPlanProvider,
} from "./specialty-misc";
import { SEARCH_VALIDATOR_CONFIGS, validateSearchProvider } from "./search";
import { validateVertexProvider } from "./vertex";

type SpecialtyValidatorResult = {
  valid: boolean;
  error: string | null;
  unsupported?: boolean;
  method?: string;
  warning?: string;
};

export const SPECIALTY_VALIDATORS: Record<
  string,
  (params: Record<string, unknown>) => Promise<SpecialtyValidatorResult>
> = {
  qoder: ({ apiKey, providerSpecificData }: Record<string, unknown>) =>
    validateQoderCliPat({
      apiKey: String(apiKey || ""),
      providerSpecificData: providerSpecificData as JsonRecord,
    }),
  deepgram: validateDeepgramProvider,
  assemblyai: validateAssemblyAIProvider,
  nanobanana: validateNanoBananaProvider,
  elevenlabs: validateElevenLabsProvider,
  inworld: validateInworldProvider,
  "bailian-coding-plan": validateBailianCodingPlanProvider,
  vertex: validateVertexProvider,
  nvidia: validateNvidiaProvider,
  longcat: validateLongcatProvider,
  "xiaomi-mimo-token-plan": validateXiaomiMimoTokenPlanProvider,
  ...Object.fromEntries(
    Object.entries(SEARCH_VALIDATOR_CONFIGS).map(([id, configFn]) => [
      id,
      ({ apiKey, providerSpecificData }: Record<string, unknown>) => {
        const { url, init } = configFn(String(apiKey || ""));
        return validateSearchProvider(url, init, providerSpecificData as JsonRecord);
      },
    ])
  ),
};
