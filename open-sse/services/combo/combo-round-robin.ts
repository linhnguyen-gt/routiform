import * as semaphore from "../rateLimitSemaphore.ts";
import { unavailableResponse } from "../../utils/error.ts";
import { resolveComboConfig, getDefaultComboConfig } from "../comboConfig.ts";
import { getCircuitBreaker } from "../../../src/shared/utils/circuitBreaker";
import { parseModel } from "../model.ts";
import { getProviderProfile } from "../accountFallback.ts";
import { resolveNestedComboModels } from "./combo-dag.ts";
import { normalizeModelEntry } from "./combo-model-entry.ts";
import { filterOrderedModelsForToolCalling } from "./combo-tool-calling-filter.ts";
import { resolveRetrySettings } from "./combo-retry-settings.ts";
import { respondComboModelsExhausted } from "./combo-exhausted-responses.ts";
import { rrCounters } from "./combo-rr-counter.ts";
import { runRoundRobinInnerRetries } from "./combo-rr-inner-retries.ts";

type LogLike = {
  info: (tag: string, msg: string, meta?: unknown) => void;
  warn: (tag: string, msg: string, meta?: unknown) => void;
};

/**
 * Handle round-robin combo: each request goes to the next model in circular order.
 */
export async function handleRoundRobinCombo(options: {
  body: { stream?: boolean; tools?: unknown[] } & Record<string, unknown>;
  combo: {
    name: string;
    models?: unknown[];
    requireToolCalling?: boolean;
    config?: Record<string, unknown>;
  };
  handleSingleModel: (body: unknown, modelStr: string) => Promise<Response>;
  isModelAvailable?: (modelStr: string) => Promise<boolean>;
  log: LogLike;
  settings?: Record<string, unknown>;
  allCombos?: unknown;
}): Promise<Response> {
  const { body, combo, handleSingleModel, isModelAvailable, log, settings, allCombos } = options;
  const models = combo.models || [];
  const config = settings
    ? resolveComboConfig(combo as never, settings)
    : { ...getDefaultComboConfig(), ...(combo.config || {}) };
  const concurrency = (config as { concurrencyPerModel?: number }).concurrencyPerModel ?? 3;
  const queueTimeout = (config as { queueTimeoutMs?: number }).queueTimeoutMs ?? 30000;
  const { maxRetries, retryDelayMs } = resolveRetrySettings(config as Record<string, unknown>);

  let orderedModels: string[];
  if (allCombos) {
    orderedModels = resolveNestedComboModels(
      combo as { name: string; models?: unknown[] },
      allCombos
    );
  } else {
    orderedModels = models.map((m) => normalizeModelEntry(m).model);
  }

  if (orderedModels.length === 0) {
    return unavailableResponse(503, "Round-robin combo has no models");
  }

  let om = filterOrderedModelsForToolCalling(orderedModels, combo, body, log);
  if (om.length === 0) {
    return unavailableResponse(
      400,
      "Combo requireToolCalling: no models in this combo support tool calling for this request"
    );
  }
  orderedModels = om;

  const modelCount = orderedModels.length;

  const counter = rrCounters.get(combo.name) || 0;
  rrCounters.set(combo.name, counter + 1);
  const startIndex = counter % modelCount;

  const startTime = Date.now();
  const state = {
    lastError: null as string | null,
    lastStatus: null as number | null,
    earliestRetryAfter: null as string | null,
    fallbackCount: 0,
  };
  let lastTriedModelIndex: number | null = null;
  let lastTriedModelStr: string | null = null;

  for (let offset = 0; offset < modelCount; offset++) {
    const modelIndex = (startIndex + offset) % modelCount;
    const modelStr = orderedModels[modelIndex];
    const parsed = parseModel(modelStr);
    const provider = parsed.provider || parsed.providerAlias || "unknown";
    const profile = getProviderProfile(provider);
    const breakerKey = `combo:${modelStr}`;
    const breaker = getCircuitBreaker(breakerKey, {
      failureThreshold: profile.circuitBreakerThreshold,
      resetTimeout: profile.circuitBreakerReset,
    });

    if (!breaker.canExecute()) {
      log.info("COMBO-RR", `Skipping ${modelStr}: circuit breaker OPEN for ${provider}`);
      if (offset > 0) state.fallbackCount++;
      continue;
    }

    if (isModelAvailable) {
      const available = await isModelAvailable(modelStr);
      if (!available) {
        log.info("COMBO-RR", `Skipping ${modelStr} (all accounts in cooldown)`);
        if (offset > 0) state.fallbackCount++;
        continue;
      }
    }

    let release: () => void;
    try {
      release = (await semaphore.acquire(modelStr, {
        maxConcurrency: concurrency,
        timeoutMs: queueTimeout,
      })) as () => void;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "SEMAPHORE_TIMEOUT") {
        log.warn("COMBO-RR", `Semaphore timeout for ${modelStr}, trying next model`);
        if (offset > 0) state.fallbackCount++;
        continue;
      }
      throw err;
    }

    try {
      lastTriedModelIndex = modelIndex;
      lastTriedModelStr = modelStr;
      const direct = await runRoundRobinInnerRetries({
        body,
        combo,
        modelStr,
        modelIndex,
        offset,
        counter,
        modelCount,
        handleSingleModel,
        log,
        maxRetries,
        retryDelayMs,
        config: config as Record<string, unknown>,
        startTime,
        state,
      });
      if (direct) return direct;
    } finally {
      release();
    }
  }

  return respondComboModelsExhausted({
    logTag: "COMBO-RR",
    orderedModels,
    combo,
    strategy: "round-robin",
    lastTriedModelIndex,
    lastTriedModelStr,
    lastStatus: state.lastStatus,
    lastError: state.lastError,
    fallbackCount: state.fallbackCount,
    startTime,
    earliestRetryAfter: state.earliestRetryAfter,
    exhaustedDefaultMessage: "All round-robin combo models unavailable",
    log,
  });
}
