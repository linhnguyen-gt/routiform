import type { RegistryModel } from "./registry-types.ts";

type JsonRecord = Record<string, unknown>;

const GLM_MODELS_URLS = {
  international: "https://api.z.ai/api/coding/paas/v4/models",
  china: "https://open.bigmodel.cn/api/coding/paas/v4/models",
} as const;

const GLM_COUNT_TOKENS_URLS = {
  international: [
    "https://api.z.ai/api/coding/paas/v4/count_tokens",
    "https://api.z.ai/api/coding/paas/v4/tokenizer",
  ],
  china: [
    "https://open.bigmodel.cn/api/coding/paas/v4/count_tokens",
    "https://open.bigmodel.cn/api/coding/paas/v4/tokenizer",
  ],
} as const;

export const GLM_SHARED_HEADERS = {
  "Anthropic-Version": "2023-06-01",
  "Anthropic-Beta": "claude-code-20250219,interleaved-thinking-2025-05-14",
};

export const GLM_SHARED_MODELS: RegistryModel[] = [
  { id: "glm-5.1", name: "GLM 5.1", contextLength: 204800 },
  { id: "glm-5", name: "GLM 5" },
  { id: "glm-5-turbo", name: "GLM 5 Turbo" },
  { id: "glm-4.7-flash", name: "GLM 4.7 Flash" },
  { id: "glm-4.7", name: "GLM 4.7" },
  { id: "glm-4.6v", name: "GLM 4.6V (Vision)", contextLength: 128000 },
  { id: "glm-4.6", name: "GLM 4.6" },
  { id: "glm-4.5v", name: "GLM 4.5V (Vision)", contextLength: 16000 },
  { id: "glm-4.5", name: "GLM 4.5", contextLength: 128000 },
  { id: "glm-4.5-air", name: "GLM 4.5 Air", contextLength: 128000 },
];

export const GLMT_REQUEST_DEFAULTS = {
  thinking: {
    type: "enabled",
  },
};

export const GLMT_TIMEOUT_MS = 180000;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function getGlmApiRegion(providerSpecificData: unknown): keyof typeof GLM_MODELS_URLS {
  const data = asRecord(providerSpecificData);
  return data.apiRegion === "china" ? "china" : "international";
}

export function getGlmModelsUrl(providerSpecificData: unknown): string {
  const region = getGlmApiRegion(providerSpecificData);
  return GLM_MODELS_URLS[region];
}

export function getGlmCountTokensUrls(providerSpecificData: unknown): string[] {
  const region = getGlmApiRegion(providerSpecificData);
  return [...GLM_COUNT_TOKENS_URLS[region]];
}
