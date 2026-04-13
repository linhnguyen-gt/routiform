/**
 * Chat Handler Helpers — FASE-09 (T-28)
 *
 * Extracted from handleSingleModelChat to keep the main handler
 * under 80 lines. These helpers encapsulate:
 *
 *   resolveModelOrError — Model lookup + error response generation
 *   logProxyAndTranslation — Side-effect logging (proxy + translation events)
 *   buildChatCoreParams — Assembles the parameter object for handleChatCore
 *
 * @module sse/handlers/chatHelpers
 */

import { getModelInfo } from "../services/model";
import { detectFormat, getTargetFormat } from "@routiform/open-sse/services/provider.ts";
import {
  getModelTargetFormat,
  PROVIDER_ID_TO_ALIAS,
} from "@routiform/open-sse/config/providerModels.ts";
import { logProxyEvent } from "../../lib/proxyLogger";
import { logTranslationEvent } from "../../lib/translatorEvents";
// updateProviderCredentials is dynamically imported from ../services/auth when needed

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Resolve a model string to provider/model or return an error response.
 *
 * @param {string} modelStr - Raw model string from request
 * @param {Function} log - Logger instance
 * @param {Function} errorResponse - Error response factory
 * @returns {Promise<{ error?: Response, provider: string, model: string, sourceFormat: string, targetFormat: string }>}
 */
export async function resolveModelOrError(
  modelStr: string,
  body: Record<string, unknown>,
  log: Record<string, unknown>,
  errorResponse: (status: number, message: string) => Response
) {
  const modelInfo = await getModelInfo(modelStr);

  if (!modelInfo.provider) {
    if ((modelInfo as Record<string, unknown>).errorType === "ambiguous_model") {
      const message =
        String((modelInfo as Record<string, unknown>).errorMessage) ||
        `Ambiguous model '${modelStr}'. Use provider/model prefix (ex: gh/${modelStr} or cc/${modelStr}).`;
      const logger = log as {
        warn: (type: string, msg: string, data: Record<string, unknown>) => void;
      };
      logger.warn("CHAT", message, {
        model: modelStr,
        candidates:
          (modelInfo as Record<string, unknown>).candidateAliases ||
          (modelInfo as Record<string, unknown>).candidateProviders ||
          [],
      });
      return { error: errorResponse(HTTP_STATUS.BAD_REQUEST, message) };
    }

    const logger = log as {
      warn: (type: string, msg: string, data: Record<string, unknown>) => void;
    };
    logger.warn("CHAT", "Invalid model format", { model: modelStr });
    return { error: errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid model format") };
  }

  const { provider, model } = modelInfo;
  const sourceFormat = detectFormat(body);
  const providerAlias = PROVIDER_ID_TO_ALIAS[provider] || provider;

  // If the custom model specifies apiFormat="responses", override targetFormat
  // to route through the Responses API translator instead of Chat Completions
  let targetFormat = getModelTargetFormat(providerAlias, model) || getTargetFormat(provider);
  if ((modelInfo as Record<string, unknown>).apiFormat === "responses") {
    targetFormat = "openai-responses";
    const logger = log as { info: (type: string, msg: string) => void };
    logger.info("ROUTING", `Custom model apiFormat=responses → targetFormat=openai-responses`);
  }

  // Log routing
  const logger = log as { info: (type: string, msg: string) => void };
  if (modelStr !== `${provider}/${model}`) {
    logger.info("ROUTING", `${modelStr} → ${provider}/${model}`);
  } else {
    logger.info("ROUTING", `Provider: ${provider}, Model: ${model}`);
  }

  return { provider, model, sourceFormat, targetFormat };
}

/**
 * Log proxy and translation events (fire-and-forget, never throws).
 *
 * @param {Object} params
 */
export function logProxyAndTranslation({
  result,
  proxyInfo,
  proxyLatency,
  provider,
  model,
  sourceFormat,
  targetFormat,
  credentials,
  comboName,
  clientRawRequest,
}) {
  // Proxy event
  try {
    const proxyData = proxyInfo?.proxy || null;
    logProxyEvent({
      status: result.success
        ? "success"
        : result.status === 408 || result.status === 504
          ? "timeout"
          : "error",
      proxy: proxyData,
      level: proxyInfo?.level || "direct",
      levelId: proxyInfo?.levelId || null,
      provider,
      targetUrl: `${provider}/${model}`,
      latencyMs: proxyLatency,
      error: result.success ? null : result.error || null,
      connectionId: credentials.connectionId,
      comboId: comboName || null,
      account: credentials.connectionId?.slice(0, 8) || null,
    });
  } catch {
    // Never let logging break the request pipeline
  }

  // Translation event
  try {
    logTranslationEvent({
      provider,
      model,
      sourceFormat,
      targetFormat,
      status: result.success ? "success" : "error",
      statusCode: result.success ? 200 : result.status || 500,
      latency: proxyLatency,
      endpoint: clientRawRequest?.endpoint || "/v1/chat/completions",
      connectionId: credentials.connectionId || null,
      comboName: comboName || null,
    });
  } catch {
    // Never let logging break the request pipeline
  }
}

/**
 * Build the params object for handleChatCore.
 *
 * @param {Object} params
 * @returns {Object} handleChatCore params
 */
export function buildChatCoreParams({
  body,
  provider,
  model,
  credentials,
  log,
  clientRawRequest,
  apiKeyInfo,
  userAgent,
  comboName,
}) {
  return {
    body: { ...body, model: `${provider}/${model}` },
    modelInfo: { provider, model },
    credentials,
    log,
    clientRawRequest,
    connectionId: credentials.connectionId,
    apiKeyInfo,
    userAgent,
    comboName,
    onCredentialsRefreshed: async (newCreds: Record<string, unknown>) => {
      const { updateProviderCredentials } = await import("../services/tokenRefresh");
      await updateProviderCredentials(credentials.connectionId, {
        accessToken: newCreds.accessToken,
        refreshToken: newCreds.refreshToken,
        providerSpecificData: newCreds.providerSpecificData,
        testStatus: "active",
      });
    },
    onRequestSuccess: async () => {
      const { clearAccountError } = await import("../services/auth");
      await clearAccountError(credentials.connectionId, credentials);
    },
  };
}
