import { recordComboRequest } from "../comboMetrics.ts";
import { validateResponseQuality } from "./combo-response-quality.ts";

type LogLike = {
  info: (tag: string, msg: string, meta?: unknown) => void;
  warn: (tag: string, msg: string, meta?: unknown) => void;
};

type BreakerLike = { _onFailure: () => void; _onSuccess: () => void };

/** RR: validate 200 body; record metrics; return response or null if bad quality. */
export async function tryRoundRobinOkResponse(options: {
  result: Response;
  body: { stream?: boolean } & Record<string, unknown>;
  log: LogLike;
  breaker: BreakerLike;
  combo: { name: string };
  modelStr: string;
  startTime: number;
  fallbackCount: number;
  modelIndex: number;
}): Promise<Response | null> {
  const { result, body, log, breaker, combo, modelStr, startTime, fallbackCount, modelIndex } =
    options;

  const quality = await validateResponseQuality(result, !!body.stream, log);
  if (!quality.valid) {
    log.warn("COMBO-RR", `${modelStr} returned 200 but failed quality check: ${quality.reason}`);
    breaker._onFailure();
    recordComboRequest(combo.name, modelStr, {
      success: false,
      latencyMs: Date.now() - startTime,
      fallbackCount,
      strategy: "round-robin",
      terminalHttpStatus: 200,
      failureModelIndex: modelIndex,
      failureModelStr: modelStr,
    });
    return null;
  }

  const latencyMs = Date.now() - startTime;
  log.info("COMBO-RR", `${modelStr} succeeded (${latencyMs}ms, ${fallbackCount} fallbacks)`);
  breaker._onSuccess();
  recordComboRequest(combo.name, modelStr, {
    success: true,
    latencyMs,
    fallbackCount,
    strategy: "round-robin",
  });
  return result;
}
