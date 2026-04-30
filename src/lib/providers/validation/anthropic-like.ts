import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { applyCustomUserAgent } from "./http-utils";

export async function validateAnthropicLikeProvider({
  apiKey,
  baseUrl,
  modelId,
  headers = {},
  providerSpecificData = {},
}: {
  apiKey: string;
  baseUrl: string;
  modelId?: string;
  headers?: Record<string, string>;
  providerSpecificData?: Record<string, unknown>;
}) {
  if (!baseUrl) {
    return { valid: false, error: "Missing base URL" };
  }

  const requestHeaders = applyCustomUserAgent(
    {
      "Content-Type": "application/json",
      ...headers,
    },
    providerSpecificData
  );

  if (!requestHeaders["x-api-key"] && !requestHeaders["X-API-Key"]) {
    requestHeaders["x-api-key"] = apiKey;
  }

  if (!requestHeaders["anthropic-version"] && !requestHeaders["Anthropic-Version"]) {
    requestHeaders["anthropic-version"] = "2023-06-01";
  }

  const testModelId =
    (typeof providerSpecificData?.validationModelId === "string"
      ? providerSpecificData.validationModelId
      : null) ||
    modelId ||
    "claude-3-5-sonnet-20241022";

  const response = await safeOutboundFetch(
    baseUrl,
    {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        model: testModelId,
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      }),
    },
    { timeoutMs: 15_000 }
  );

  if (response.status === 401 || response.status === 403) {
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true, error: null };
}
