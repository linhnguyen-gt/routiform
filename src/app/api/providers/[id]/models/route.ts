import { handleGetModels } from "./get-models-route-handler";

export {
  buildCodexModelsEndpoints,
  mapCodexModelsFromApi,
  normalizeCodexModelsBaseUrl,
} from "./codex-models";
export { buildNvidiaModelsUrl } from "./nvidia-models-url";
export { getStaticModelsForProvider } from "./static-model-providers-registry";

export const GET = handleGetModels;
