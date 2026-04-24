import { getProviderProfile } from "../accountFallback.ts";
import { getCircuitBreaker } from "../../../src/shared/utils/circuitBreaker";
import { parseModel } from "../model.ts";
import { respondComboModelsExhausted } from "./combo-exhausted-responses.ts";
import { readUpstreamErrorFromResponse } from "./combo-parse-upstream-error.ts";
import {
  resolveStandardNonOkAttempt,
  resolveStandardOkAttempt,
} from "./combo-standard-retry-outcome.ts";

type LogLike = {
  info: (tag: string, msg: string, meta?: unknown) => void;
  warn: (tag: string, msg: string, meta?: unknown) => void;
};

export async function runStandardComboFallbackChain(options: {
  orderedModels: string[];
  combo: { name: string; id?: string; requireToolCalling?: boolean };
  body: { stream?: boolean; tools?: unknown[] } & Record<string, unknown>;
  strategy: string;
  handleSingleModelWrapped: (body: unknown, modelStr: string) => Promise<Response>;
  isModelAvailable?: (modelStr: string) => Promise<boolean>;
  log: LogLike;
  maxRetries: number;
  retryDelayMs: number;
  config: Record<string, unknown>;
}): Promise<Response> {
  const {
    orderedModels,
    combo,
    body,
    strategy,
    handleSingleModelWrapped,
    isModelAvailable,
    log,
    maxRetries,
    retryDelayMs,
    config,
  } = options;

  let lastError: string | null = null;
  let earliestRetryAfter: string | null = null;
  let lastStatus: number | null = null;
  const startTime = Date.now();
  let fallbackCount = 0;
  let lastTriedModelIndex: number | null = null;
  let lastTriedModelStr: string | null = null;

  for (let i = 0; i < orderedModels.length; i++) {
    const modelStr = orderedModels[i];
    const parsed = parseModel(modelStr);
    const provider = parsed.provider || parsed.providerAlias || "unknown";
    const profile = getProviderProfile(provider);
    const breakerKey = `combo:${modelStr}`;
    const breaker = getCircuitBreaker(breakerKey, {
      failureThreshold: profile.circuitBreakerThreshold,
      resetTimeout: profile.circuitBreakerReset,
    });

    if (!breaker.canExecute()) {
      log.info("COMBO", `Skipping ${modelStr}: circuit breaker OPEN for ${provider}`);
      if (i > 0) fallbackCount++;
      continue;
    }

    if (isModelAvailable) {
      const available = await isModelAvailable(modelStr);
      if (!available) {
        log.info("COMBO", `Skipping ${modelStr} (all accounts in cooldown)`);
        if (i > 0) fallbackCount++;
        continue;
      }
    }

    let nextRetryDelayMs = retryDelayMs;
    for (let retry = 0; retry <= maxRetries; retry++) {
      if (retry > 0) {
        log.info(
          "COMBO",
          `Retrying ${modelStr} in ${nextRetryDelayMs}ms (attempt ${retry + 1}/${maxRetries + 1})`
        );
        await new Promise((r) => setTimeout(r, nextRetryDelayMs));
      }

      log.info(
        "COMBO",
        `Trying model ${i + 1}/${orderedModels.length}: ${modelStr}${retry > 0 ? ` (retry ${retry})` : ""}`
      );

      lastTriedModelIndex = i;
      lastTriedModelStr = modelStr;
      const result = await handleSingleModelWrapped(body, modelStr);

      if (result.ok) {
        const ok = await resolveStandardOkAttempt({
          result,
          body,
          log,
          breaker,
          combo,
          modelStr,
          startTime,
          fallbackCount,
          strategy,
          modelIndex: i,
          provider,
          comboIdOrName: combo.id || combo.name,
        });
        if (ok.kind === "bad_quality") {
          if (i > 0) fallbackCount++;
          break;
        }
        return ok.response;
      }

      const { errorText, retryAfter } = await readUpstreamErrorFromResponse(result);
      const non = await resolveStandardNonOkAttempt({
        result,
        errStr: errorText,
        retryAfter,
        earliestRetryAfter,
        provider,
        combo,
        modelStr,
        strategy,
        orderedModelsLength: orderedModels.length,
        modelIndex: i,
        log,
        breaker,
        startTime,
        fallbackCount,
        retry,
        maxRetries,
        retryDelayMs,
        config,
      });

      if (non.kind === "terminal") return non.response;
      if (non.kind === "retry") {
        earliestRetryAfter = non.earliestRetryAfter;
        nextRetryDelayMs = non.nextDelayMs;
        continue;
      }

      earliestRetryAfter = non.earliestRetryAfter;
      lastError = non.lastError;
      if (!lastStatus) lastStatus = non.lastStatus;
      if (i > 0) fallbackCount++;
      break;
    }
  }

  return respondComboModelsExhausted({
    logTag: "COMBO",
    orderedModels,
    combo,
    strategy,
    lastTriedModelIndex,
    lastTriedModelStr,
    lastStatus,
    lastError,
    fallbackCount,
    startTime,
    earliestRetryAfter,
    exhaustedDefaultMessage: "All combo models unavailable",
    log,
  });
}
