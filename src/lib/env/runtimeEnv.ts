import { getUpstreamTimeoutConfig } from "@/shared/utils/runtimeTimeouts";

type EnvSource = Record<string, string | undefined>;

export type RuntimeEnvConfig = {
  strict: boolean;
  requestTimeoutMs: number;
  streamIdleTimeoutMs: number;
  fetchHeadersTimeoutMs: number;
  fetchBodyTimeoutMs: number;
};

const TIMEOUT_ENV_KEYS = [
  "REQUEST_TIMEOUT_MS",
  "FETCH_TIMEOUT_MS",
  "STREAM_IDLE_TIMEOUT_MS",
  "FETCH_HEADERS_TIMEOUT_MS",
  "FETCH_BODY_TIMEOUT_MS",
] as const;

function parseStrictToggle(value: string | undefined): boolean {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isValidTimeoutValue(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function collectInvalidTimeoutEnv(env: EnvSource): Array<{ key: string; value: string }> {
  const invalid: Array<{ key: string; value: string }> = [];
  for (const key of TIMEOUT_ENV_KEYS) {
    const value = env[key];
    if (value == null || value.trim() === "") continue;
    if (!isValidTimeoutValue(value)) {
      invalid.push({ key, value });
    }
  }
  return invalid;
}

export function getRuntimeEnvConfig(
  env: EnvSource = process.env,
  logger: (message: string) => void = () => {}
): RuntimeEnvConfig {
  const strict = parseStrictToggle(env.RUNTIME_ENV_STRICT);
  const invalid = collectInvalidTimeoutEnv(env);

  if (invalid.length > 0) {
    const message = `Invalid timeout env values: ${invalid
      .map((item) => `${item.key}=${JSON.stringify(item.value)}`)
      .join(", ")}`;
    if (strict) {
      throw new Error(`[runtime-env] ${message}`);
    }
    logger(`[runtime-env] ${message}; falling back to defaults`);
  }

  const upstream = getUpstreamTimeoutConfig(env, logger);

  return {
    strict,
    requestTimeoutMs: upstream.fetchTimeoutMs,
    streamIdleTimeoutMs: upstream.streamIdleTimeoutMs,
    fetchHeadersTimeoutMs: upstream.fetchHeadersTimeoutMs,
    fetchBodyTimeoutMs: upstream.fetchBodyTimeoutMs,
  };
}
