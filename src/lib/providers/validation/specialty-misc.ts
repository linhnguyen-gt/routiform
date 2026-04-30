import {
  XIAOMI_MIMO_TOKEN_PLAN_CLUSTERS,
  normalizeXiaomiTokenPlanClusterBaseUrl,
} from "@routiform/open-sse/config/xiaomiMimoTokenPlanClusters.ts";
import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import type { JsonRecord } from "./constants";
import { buildBearerHeaders, toValidationErrorMessage } from "./http-utils";
import { validateOpenAILikeProvider } from "./openai-like";
import { normalizeBaseUrl } from "./url-utils";

export async function validateNvidiaProvider({
  apiKey,
  providerSpecificData: psd,
}: Record<string, unknown>) {
  const providerSpecificData = (psd || {}) as Record<string, unknown>;
  try {
    const baseUrl =
      typeof providerSpecificData.baseUrl === "string"
        ? normalizeBaseUrl(providerSpecificData.baseUrl)
        : "https://integrate.api.nvidia.com/v1";
    const res = await safeOutboundFetch(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: buildBearerHeaders(String(apiKey || ""), providerSpecificData as JsonRecord),
        body: JSON.stringify({
          model: "meta/llama-3.3-70b-instruct",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1,
        }),
      },
      { timeoutMs: 15_000 }
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    if (res.status === 404 || res.status === 405) {
      return {
        valid: false,
        error: "NVIDIA validation endpoint not found (check base URL and endpoint)",
      };
    }

    if (res.status >= 500) {
      return { valid: false, error: `NVIDIA upstream unavailable (${res.status})` };
    }

    if (!res.ok) {
      return { valid: false, error: `NVIDIA validation failed (${res.status})` };
    }

    return { valid: true, error: null };
  } catch (error: unknown) {
    return {
      valid: false,
      error: toValidationErrorMessage(error, "Connection failed"),
    };
  }
}

export async function validateLongcatProvider({
  apiKey,
  providerSpecificData,
}: Record<string, unknown>) {
  try {
    const res = await safeOutboundFetch(
      "https://api.longcat.chat/openai/v1/chat/completions",
      {
        method: "POST",
        headers: buildBearerHeaders(String(apiKey || ""), providerSpecificData as JsonRecord),
        body: JSON.stringify({
          model: "longcat",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1,
        }),
      },
      { timeoutMs: 15_000 }
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    // Any non-auth response (200, 400, 422) means auth passed
    return { valid: true, error: null };
  } catch (error: unknown) {
    return {
      valid: false,
      error: toValidationErrorMessage(error, "Connection failed"),
    };
  }
}

export async function validateXiaomiMimoTokenPlanProvider({
  apiKey,
  providerSpecificData: psd,
}: Record<string, unknown>) {
  const providerSpecificData = (psd || {}) as Record<string, unknown>;
  const raw =
    typeof providerSpecificData.baseUrl === "string" ? providerSpecificData.baseUrl.trim() : "";
  if (!raw) {
    return {
      valid: false,
      error: "Select a Token Plan cluster (China, Singapore, or Europe).",
    };
  }
  const root = normalizeXiaomiTokenPlanClusterBaseUrl(raw);
  const allowed = new Set<string>(XIAOMI_MIMO_TOKEN_PLAN_CLUSTERS.map((c) => c.baseUrl));
  if (!root || !allowed.has(root)) {
    return {
      valid: false,
      error: "Unknown cluster; pick China, Singapore, or Europe (cluster root only).",
    };
  }
  const baseUrl = `${root}/v1`;
  return validateOpenAILikeProvider({
    provider: "xiaomi-mimo-token-plan",
    apiKey: String(apiKey || ""),
    baseUrl,
    providerSpecificData,
    modelId: "mimo-v2-pro",
  });
}
