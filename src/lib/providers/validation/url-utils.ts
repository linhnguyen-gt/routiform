import {
  stripAnthropicMessagesSuffix,
  stripClaudeCodeCompatibleEndpointSuffix,
} from "@routiform/open-sse/services/claudeCodeCompatible.ts";
import { isOpenAICompatibleProvider } from "@/shared/constants/providers";

export function normalizeBaseUrl(baseUrl: string) {
  return (baseUrl || "").trim().replace(/\/$/, "");
}

export function normalizeAnthropicBaseUrl(baseUrl: string) {
  return stripAnthropicMessagesSuffix(baseUrl || "");
}

export function normalizeClaudeCodeCompatibleBaseUrl(baseUrl: string) {
  return stripClaudeCodeCompatibleEndpointSuffix(baseUrl || "");
}

export function addModelsSuffix(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  const suffixes = ["/chat/completions", "/responses", "/chat", "/messages"];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      return `${normalized.slice(0, -suffix.length)}/models`;
    }
  }

  return `${normalized}/models`;
}

export function resolveBaseUrl(
  entry: Record<string, unknown>,
  providerSpecificData: Record<string, unknown> = {}
) {
  if (providerSpecificData?.baseUrl && typeof providerSpecificData.baseUrl === "string") {
    return normalizeBaseUrl(providerSpecificData.baseUrl);
  }
  if (entry?.baseUrl && typeof entry.baseUrl === "string") {
    return normalizeBaseUrl(entry.baseUrl);
  }
  return "";
}

export function resolveChatUrl(
  provider: string,
  baseUrl: string,
  providerSpecificData: Record<string, unknown> = {}
) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  if (isOpenAICompatibleProvider(provider)) {
    if (providerSpecificData?.chatPath) {
      return `${normalized}${providerSpecificData.chatPath}`;
    }
    if (providerSpecificData?.apiType === "responses") {
      return `${normalized}/responses`;
    }
    return `${normalized}/chat/completions`;
  }

  if (
    normalized.endsWith("/chat/completions") ||
    normalized.endsWith("/responses") ||
    normalized.endsWith("/chat")
  ) {
    return normalized;
  }

  if (normalized.endsWith("/v1")) {
    return `${normalized}/chat/completions`;
  }

  return normalized;
}
