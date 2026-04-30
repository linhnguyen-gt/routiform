import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { applyCustomUserAgent, toValidationErrorMessage } from "./http-utils";
import { normalizeBaseUrl } from "./url-utils";

export async function validateBailianCodingPlanProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  try {
    const rawBaseUrl =
      (typeof providerSpecificData.baseUrl === "string"
        ? normalizeBaseUrl(providerSpecificData.baseUrl)
        : null) || "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic/v1";
    const baseUrl = rawBaseUrl.endsWith("/messages")
      ? rawBaseUrl.slice(0, -"/messages".length)
      : rawBaseUrl;
    // bailian-coding-plan uses DashScope Anthropic-compatible messages endpoint
    // It does NOT expose /v1/models — use messages probe directly
    const messagesUrl = `${baseUrl}/messages`;

    const response = await safeOutboundFetch(
      messagesUrl,
      {
        method: "POST",
        headers: applyCustomUserAgent(
          {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          providerSpecificData
        ),
        body: JSON.stringify({
          model: "qwen3-coder-plus",
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
      },
      { timeoutMs: 15_000 }
    );

    // 401/403 => invalid key
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    // Non-auth 4xx (e.g., 400 bad request) means auth passed but request was malformed
    if (response.status >= 400 && response.status < 500) {
      return { valid: true, error: null };
    }

    if (response.ok) {
      return { valid: true, error: null };
    }

    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Validation failed") };
  }
}
