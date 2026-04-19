type ValidationIssue = {
  key: string;
  message: string;
  hint: string;
};

type ValidationResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

const VALID_NODE_ENVS = new Set(["development", "production", "test"]);
const STRICT_BOOLEAN_VALUES = new Set(["true", "false"]);
const LEGACY_BOOLEAN_VALUES = new Set(["true", "false", "1", "0", "yes", "no", "on", "off"]);

const STRICT_BOOLEAN_KEYS = [
  "REQUIRE_API_KEY",
  "AUTH_COOKIE_SECURE",
  "ALLOW_API_KEY_REVEAL",
  "PRICING_SYNC_ENABLED",
];

const LEGACY_BOOLEAN_COMPAT_KEYS = ["DISABLE_SQLITE_AUTO_BACKUP"];

const NON_NEGATIVE_INT_ENV_KEYS = [
  "PROVIDER_LIMITS_SYNC_INTERVAL_MINUTES",
  "ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC",
  "TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC",
  "SHUTDOWN_TIMEOUT_MS",
  "FETCH_TIMEOUT_MS",
  "STREAM_IDLE_TIMEOUT_MS",
];

function normalize(value: string | undefined): string {
  return String(value ?? "").trim();
}

function isBooleanLike(value: string, allowedValues: Set<string>): boolean {
  return allowedValues.has(value.toLowerCase());
}

function isNonNegativeIntegerLike(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0;
}

function isValidPort(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535;
}

export function validateRuntimeEnv(env: NodeJS.ProcessEnv = process.env): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const nodeEnv = normalize(env.NODE_ENV);
  if (nodeEnv && !VALID_NODE_ENVS.has(nodeEnv)) {
    warnings.push({
      key: "NODE_ENV",
      message: `Invalid NODE_ENV: \"${nodeEnv}\".`,
      hint: "Recommended values are: development, production, test.",
    });
  }

  const storageDriver = normalize(env.STORAGE_DRIVER);
  if (storageDriver && storageDriver !== "sqlite") {
    errors.push({
      key: "STORAGE_DRIVER",
      message: `Unsupported STORAGE_DRIVER: \"${storageDriver}\".`,
      hint: "Set STORAGE_DRIVER=sqlite.",
    });
  }

  const dataDir = env.DATA_DIR;
  if (typeof dataDir === "string" && dataDir.length > 0 && !dataDir.trim()) {
    errors.push({
      key: "DATA_DIR",
      message: "DATA_DIR is set but blank.",
      hint: "Set a writable path or remove DATA_DIR to use the default location.",
    });
  }

  for (const portKey of ["PORT", "API_PORT", "DASHBOARD_PORT"]) {
    const raw = normalize(env[portKey]);
    if (!raw) continue;
    if (!isValidPort(raw)) {
      errors.push({
        key: portKey,
        message: `${portKey} must be an integer between 1 and 65535 (received \"${raw}\").`,
        hint: `Set ${portKey} to a valid TCP port value.`,
      });
    }
  }

  for (const envKey of STRICT_BOOLEAN_KEYS) {
    const raw = normalize(env[envKey]);
    if (!raw) continue;
    if (isBooleanLike(raw, STRICT_BOOLEAN_VALUES)) continue;
    if (isBooleanLike(raw, LEGACY_BOOLEAN_VALUES)) {
      warnings.push({
        key: envKey,
        message: `${envKey} uses legacy boolean literal \"${raw}\". Runtime accepts it today but this may change.`,
        hint: "Use literal true or false for stable behavior.",
      });
      continue;
    }
    errors.push({
      key: envKey,
      message: `${envKey} must be boolean-like (received \"${raw}\").`,
      hint: `Use one of: ${Array.from(LEGACY_BOOLEAN_VALUES).join(", ")}.`,
    });
  }

  for (const envKey of LEGACY_BOOLEAN_COMPAT_KEYS) {
    const raw = normalize(env[envKey]);
    if (!raw) continue;
    if (!isBooleanLike(raw, LEGACY_BOOLEAN_VALUES)) {
      errors.push({
        key: envKey,
        message: `${envKey} must be boolean-like (received \"${raw}\").`,
        hint: `Use one of: ${Array.from(LEGACY_BOOLEAN_VALUES).join(", ")}.`,
      });
    }
  }

  for (const envKey of NON_NEGATIVE_INT_ENV_KEYS) {
    const raw = normalize(env[envKey]);
    if (!raw) continue;
    if (!isNonNegativeIntegerLike(raw)) {
      errors.push({
        key: envKey,
        message: `${envKey} must be a non-negative integer (received \"${raw}\").`,
        hint: `Set ${envKey} to a value like 0, 5, 30, or 60000.`,
      });
    }
  }

  const staggerPrimary = normalize(env.ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC);
  const staggerFallback = normalize(env.TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC);
  if (staggerPrimary && staggerFallback && staggerPrimary !== staggerFallback) {
    warnings.push({
      key: "ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC",
      message:
        "Both ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC and TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC are set with different values.",
      hint: "Keep one value to avoid confusion. ROUTIFORM_TOKEN_HEALTHCHECK_STAGGER_WINDOW_SEC takes precedence.",
    });
  }

  return { errors, warnings };
}

function printIssue(
  logger: Pick<Console, "warn" | "error">,
  level: "warn" | "error",
  issue: ValidationIssue
) {
  logger[level](`[ENV] ${issue.key}: ${issue.message}`);
  logger[level](`[ENV]   -> ${issue.hint}`);
}

export function enforceRuntimeEnv(
  logger: Pick<Console, "warn" | "error"> = console,
  env: NodeJS.ProcessEnv = process.env
): void {
  const result = validateRuntimeEnv(env);

  for (const warning of result.warnings) {
    printIssue(logger, "warn", warning);
  }

  if (result.errors.length === 0) return;

  logger.error("");
  logger.error("[ENV] Invalid runtime environment configuration detected:");
  for (const error of result.errors) {
    printIssue(logger, "error", error);
  }
  logger.error("");

  throw new Error("Invalid runtime environment configuration");
}
