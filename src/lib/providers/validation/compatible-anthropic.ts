import { joinBaseUrlAndPath } from "@routiform/open-sse/services/claudeCodeCompatible.ts";
import { isOutboundUrlPolicyError, safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { applyCustomUserAgent, toValidationErrorMessage } from "./http-utils";
import { normalizeAnthropicBaseUrl } from "./url-utils";

export async function validateAnthropicCompatibleProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  let baseUrl =
    typeof providerSpecificData.baseUrl === "string"
      ? normalizeAnthropicBaseUrl(providerSpecificData.baseUrl)
      : "";
  if (!baseUrl) {
    return { valid: false, error: "No base URL configured for Anthropic compatible provider" };
  }

  const headers = applyCustomUserAgent(
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      Authorization: `Bearer ${apiKey}`,
    },
    providerSpecificData
  );

  // Step 1: Try GET /models
  try {
    const modelsPath =
      typeof providerSpecificData?.modelsPath === "string"
        ? providerSpecificData.modelsPath
        : "/models";
    const modelsRes = await safeOutboundFetch(
      joinBaseUrlAndPath(baseUrl, modelsPath),
      {
        method: "GET",
        headers,
      },
      { timeoutMs: 10_000 }
    );

    if (modelsRes.ok) {
      return { valid: true, error: null };
    }

    if (modelsRes.status === 401 || modelsRes.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
  } catch (error: unknown) {
    if (isOutboundUrlPolicyError(error)) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
      };
    }
    // /models fetch failed — fall through to messages test
  }

  // Step 2: Fallback — try a minimal messages request
  const testModelId =
    typeof providerSpecificData?.validationModelId === "string"
      ? providerSpecificData.validationModelId
      : "claude-3-5-sonnet-20241022";
  try {
    const chatPath =
      typeof providerSpecificData?.chatPath === "string"
        ? providerSpecificData.chatPath
        : "/messages";
    const messagesRes = await safeOutboundFetch(
      joinBaseUrlAndPath(baseUrl, chatPath),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: testModelId,
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
      },
      { timeoutMs: 15_000 }
    );

    if (messagesRes.status === 401 || messagesRes.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    // Any other response (200, 400, 422, etc.) means auth passed
    return { valid: true, error: null };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Connection failed") };
  }
}
