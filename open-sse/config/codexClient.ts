const DEFAULT_CODEX_CLIENT_VERSION = "0.92.0";
const DEFAULT_CODEX_USER_AGENT = "codex-cli/0.92.0 (Windows 10.0.26100; x64)";

function normalizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function readSanitizedEnv(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const normalized = normalizeHeaderValue(raw);
  return normalized.length > 0 ? normalized : null;
}

export function getCodexClientVersion(): string {
  return readSanitizedEnv("CODEX_CLIENT_VERSION") || DEFAULT_CODEX_CLIENT_VERSION;
}

export function getCodexUserAgent(): string {
  return readSanitizedEnv("CODEX_USER_AGENT") || DEFAULT_CODEX_USER_AGENT;
}

export function getCodexDefaultHeaders(): Record<string, string> {
  return {
    Version: getCodexClientVersion(),
    "Openai-Beta": "responses=experimental",
    "User-Agent": getCodexUserAgent(),
  };
}
