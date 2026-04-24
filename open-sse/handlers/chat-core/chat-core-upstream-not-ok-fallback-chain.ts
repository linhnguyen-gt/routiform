import { buildErrorBody, createErrorResult } from "../../utils/error.ts";
import { handleEmergencyFallback } from "../phases/emergency-fallback-handler.ts";
import {
  handleModelFallback,
  shouldAttemptModelFallback,
} from "../phases/model-fallback-handler.ts";
import type { ProviderCredentials } from "../types/chat-core.ts";
import type { ChatCorePipeline } from "./chat-core-pipeline.ts";

type PhaseOutcome = { done: true; result: unknown } | { done: false };

export type NotOkMutable = {
  providerResponse: Response;
  providerUrl: string;
  providerHeaders: Headers;
  finalBody: unknown;
  currentModel: string;
  upstreamErrorBody: unknown;
};

export async function runUpstreamNotOkFallbackChain(
  p: ChatCorePipeline,
  s: NotOkMutable,
  args: {
    statusCode: number;
    message: string;
    retryAfterMs: number | null;
    errMsg: string;
    translatedBody: Record<string, unknown>;
    triedModels: Set<string>;
  }
): Promise<PhaseOutcome> {
  const log = p.log as {
    info?: (t: string, m: string) => void;
  };
  const credentials = p.credentials as Record<string, unknown>;
  const streamController = p.streamController as NonNullable<ChatCorePipeline["streamController"]>;
  const executeProviderRequest = p.executeProviderRequest as NonNullable<
    ChatCorePipeline["executeProviderRequest"]
  >;
  const persistAttemptLogs = p.persistAttemptLogs as NonNullable<
    ChatCorePipeline["persistAttemptLogs"]
  >;
  const reqLogger = p.reqLogger as {
    logTargetRequest: (u: string, h: Headers, b: unknown) => void;
  };

  let {
    providerResponse,
    providerUrl,
    providerHeaders,
    finalBody,
    currentModel,
    upstreamErrorBody,
  } = s;
  const { statusCode, message, retryAfterMs, errMsg, translatedBody, triedModels } = args;

  const fallbackResult = handleModelFallback({
    statusCode,
    message,
    currentModel,
    triedModels,
    log,
  });

  if (fallbackResult.attempted && fallbackResult.nextModel) {
    currentModel = fallbackResult.nextModel;
    translatedBody.model = fallbackResult.nextModel;
    const errorCode = fallbackResult.nextModel.includes("overflow")
      ? "context_overflow"
      : "model_unavailable";
    try {
      const fallbackExecResult = await executeProviderRequest(fallbackResult.nextModel, false);
      if (fallbackExecResult.response.ok) {
        providerResponse = fallbackExecResult.response;
        providerUrl = fallbackExecResult.url;
        providerHeaders = fallbackExecResult.headers;
        finalBody = fallbackExecResult.transformedBody;
        reqLogger.logTargetRequest(providerUrl, providerHeaders, finalBody);
        log?.info?.(
          errorCode === "context_overflow" ? "CONTEXT_OVERFLOW_FALLBACK" : "MODEL_FALLBACK",
          `Serving ${fallbackResult.nextModel} as fallback for ${p.model}`
        );
      } else {
        persistAttemptLogs({
          status: statusCode,
          error: errMsg,
          providerRequest: finalBody || translatedBody,
          providerResponse: upstreamErrorBody,
          clientResponse: buildErrorBody(statusCode, errMsg),
        });
        p.persistFailureUsage(statusCode, errorCode);
        return { done: true, result: createErrorResult(statusCode, errMsg, retryAfterMs) };
      }
    } catch {
      persistAttemptLogs({
        status: statusCode,
        error: errMsg,
        providerRequest: finalBody || translatedBody,
        providerResponse: upstreamErrorBody,
        clientResponse: buildErrorBody(statusCode, errMsg),
      });
      p.persistFailureUsage(statusCode, errorCode);
      return { done: true, result: createErrorResult(statusCode, errMsg, retryAfterMs) };
    }
  } else if (fallbackResult.error) {
    const errorCode = shouldAttemptModelFallback(statusCode, message)
      ? message.toLowerCase().includes("context")
        ? "context_overflow"
        : "model_unavailable"
      : `upstream_${statusCode}`;
    persistAttemptLogs({
      status: statusCode,
      error: errMsg,
      providerRequest: finalBody || translatedBody,
      providerResponse: upstreamErrorBody,
      clientResponse: buildErrorBody(statusCode, errMsg),
    });
    p.persistFailureUsage(statusCode, errorCode);
    return { done: true, result: createErrorResult(statusCode, errMsg, retryAfterMs) };
  } else {
    persistAttemptLogs({
      status: statusCode,
      error: errMsg,
      providerRequest: finalBody || translatedBody,
      providerResponse: upstreamErrorBody,
      clientResponse: buildErrorBody(statusCode, errMsg),
    });
    p.persistFailureUsage(statusCode, `upstream_${statusCode}`);
    return { done: true, result: createErrorResult(statusCode, errMsg, retryAfterMs) };
  }

  const requestHasTools = Array.isArray(translatedBody.tools) && translatedBody.tools.length > 0;
  const emergencyFallbackResult = await handleEmergencyFallback({
    statusCode,
    message,
    stream: Boolean(p.stream),
    requestHasTools,
    provider: p.provider,
    translatedBody,
    credentials: credentials as ProviderCredentials,
    streamController: { signal: streamController.signal },
    extendedContext: typeof p.extendedContext === "boolean" ? p.extendedContext : undefined,
    log,
  });
  if (emergencyFallbackResult.success) {
    providerResponse = emergencyFallbackResult.response!;
    providerUrl = emergencyFallbackResult.url!;
    providerHeaders = new Headers(emergencyFallbackResult.headers!);
    finalBody = emergencyFallbackResult.transformedBody!;
    reqLogger.logTargetRequest(providerUrl, providerHeaders, finalBody);
  }

  s.providerResponse = providerResponse;
  s.providerUrl = providerUrl;
  s.providerHeaders = providerHeaders;
  s.finalBody = finalBody;
  s.currentModel = currentModel;
  s.upstreamErrorBody = upstreamErrorBody;
  p.translatedBody = translatedBody;
  return { done: false };
}
