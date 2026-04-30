import { getRegistryEntry } from "@routiform/open-sse/config/registry-lookup.ts";
import {
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
  isOpenAICompatibleProvider,
} from "@/shared/constants/providers";
import { GEMINI_LIKE_FORMATS, OPENAI_LIKE_FORMATS } from "./constants";
import { validateAnthropicLikeProvider } from "./anthropic-like";
import { validateClaudeCodeCompatibleProvider } from "./claude-code-compatible";
import { validateAnthropicCompatibleProvider } from "./compatible-anthropic";
import { validateOpenAICompatibleProvider } from "./compatible-openai";
import { validateGeminiLikeProvider } from "./gemini-like";
import { toValidationErrorMessage } from "./http-utils";
import { validateOpenAILikeProvider } from "./openai-like";
import { SPECIALTY_VALIDATORS } from "./specialty-registry";
import { resolveBaseUrl } from "./url-utils";

export async function validateProviderApiKey({
  provider,
  apiKey,
  providerSpecificData = {},
}: {
  provider: string;
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  if (!provider || !apiKey) {
    return { valid: false, error: "Provider and API key required", unsupported: false };
  }

  if (isOpenAICompatibleProvider(provider)) {
    try {
      return await validateOpenAICompatibleProvider({ apiKey, providerSpecificData });
    } catch (error: unknown) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
        unsupported: false,
      };
    }
  }

  if (isAnthropicCompatibleProvider(provider)) {
    try {
      if (isClaudeCodeCompatibleProvider(provider)) {
        return await validateClaudeCodeCompatibleProvider({ apiKey, providerSpecificData });
      }
      return await validateAnthropicCompatibleProvider({ apiKey, providerSpecificData });
    } catch (error: unknown) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
        unsupported: false,
      };
    }
  }

  if (SPECIALTY_VALIDATORS[provider]) {
    try {
      return await SPECIALTY_VALIDATORS[provider]({ apiKey, providerSpecificData });
    } catch (error: unknown) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
        unsupported: false,
      };
    }
  }

  const entry = getRegistryEntry(provider);
  if (!entry) {
    return { valid: false, error: "Provider validation not supported", unsupported: true };
  }

  const entryRecord = entry as unknown as Record<string, unknown>;
  const models = Array.isArray(entryRecord.models) ? entryRecord.models : [];
  const firstModel = models[0] as Record<string, unknown> | undefined;
  const modelId = firstModel?.id ? String(firstModel.id) : null;
  // Use testKeyBaseUrl if defined — validation base can differ from the registry chat base.
  const validationEntry = entryRecord.testKeyBaseUrl
    ? { ...entry, baseUrl: entryRecord.testKeyBaseUrl }
    : entry;
  const baseUrl = resolveBaseUrl(
    validationEntry as unknown as Record<string, unknown>,
    providerSpecificData as Record<string, unknown>
  );

  try {
    const format = typeof entryRecord.format === "string" ? entryRecord.format : "";
    if (OPENAI_LIKE_FORMATS.has(format)) {
      return await validateOpenAILikeProvider({
        provider,
        apiKey,
        baseUrl,
        providerSpecificData,
        modelId: modelId || undefined,
        modelsUrl: typeof entryRecord.modelsUrl === "string" ? entryRecord.modelsUrl : undefined,
      });
    }

    if (format === "claude") {
      const urlSuffix = typeof entryRecord.urlSuffix === "string" ? entryRecord.urlSuffix : "";
      const requestBaseUrl = `${baseUrl}${urlSuffix}`;
      const requestHeaders: Record<string, string> = {
        ...(entryRecord.headers && typeof entryRecord.headers === "object"
          ? (entryRecord.headers as Record<string, string>)
          : {}),
      };

      const authHeader =
        typeof entryRecord.authHeader === "string" ? entryRecord.authHeader.toLowerCase() : "";
      if (authHeader === "x-api-key") {
        requestHeaders["x-api-key"] = apiKey;
      } else {
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
      }

      return await validateAnthropicLikeProvider({
        apiKey,
        baseUrl: requestBaseUrl,
        modelId: modelId || undefined,
        headers: requestHeaders,
        providerSpecificData,
      });
    }

    if (GEMINI_LIKE_FORMATS.has(format)) {
      return await validateGeminiLikeProvider({
        apiKey,
        baseUrl,
        providerSpecificData,
        authType: typeof entryRecord.authType === "string" ? entryRecord.authType : undefined,
      });
    }

    return { valid: false, error: "Provider validation not supported", unsupported: true };
  } catch (error: unknown) {
    return {
      valid: false,
      error: toValidationErrorMessage(error, "Validation failed"),
      unsupported: false,
    };
  }
}
