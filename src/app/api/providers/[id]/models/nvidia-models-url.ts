const DEFAULT_NVIDIA_MODELS_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

export function buildNvidiaModelsUrl(baseUrl: string | null): string {
  let normalized = (baseUrl || DEFAULT_NVIDIA_MODELS_BASE_URL).trim().replace(/\/$/, "");

  if (normalized.endsWith("/chat/completions")) {
    normalized = normalized.slice(0, -17);
  } else if (normalized.endsWith("/completions")) {
    normalized = normalized.slice(0, -12);
  }

  if (normalized.endsWith("/models")) {
    return normalized;
  }
  if (normalized.endsWith("/v1")) {
    return `${normalized}/models`;
  }
  return `${normalized}/v1/models`;
}
