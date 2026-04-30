import { isOutboundUrlPolicyError } from "@/lib/network/safeOutboundFetch";

export function getCustomUserAgent(providerSpecificData: Record<string, unknown> = {}) {
  if (typeof providerSpecificData?.customUserAgent !== "string") return null;
  const customUserAgent = providerSpecificData.customUserAgent.trim();
  return customUserAgent || null;
}

export function applyCustomUserAgent(
  headers: Record<string, string>,
  providerSpecificData: Record<string, unknown> = {}
) {
  const customUserAgent = getCustomUserAgent(providerSpecificData);
  if (!customUserAgent) return headers;
  headers["User-Agent"] = customUserAgent;
  if ("user-agent" in headers) {
    headers["user-agent"] = customUserAgent;
  }
  return headers;
}

export function withCustomUserAgent(
  init: RequestInit,
  providerSpecificData: Record<string, unknown> = {}
) {
  return {
    ...init,
    headers: applyCustomUserAgent(
      { ...((init.headers as Record<string, string> | undefined) || {}) },
      providerSpecificData
    ),
  };
}

export function isTimeoutLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = (error.name || "").toLowerCase();
  const message = (error.message || "").toLowerCase();
  return (
    name === "aborterror" ||
    name === "timeouterror" ||
    message.includes("aborted due to timeout") ||
    message.includes("timeout")
  );
}

export function toValidationErrorMessage(error: unknown, fallback: string): string {
  if (isOutboundUrlPolicyError(error)) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function buildBearerHeaders(
  apiKey: string,
  providerSpecificData: Record<string, unknown> = {}
) {
  return applyCustomUserAgent(
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    providerSpecificData
  );
}
