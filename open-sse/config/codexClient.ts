const DEFAULT_CODEX_CLIENT_VERSION = "0.124.0";
const DEFAULT_CODEX_USER_AGENT = "codex_cli_rs/0.124.0 (Mac OS 14.0.0; arm64) reqwest/0.12";

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
    "User-Agent": getCodexUserAgent(),
    originator: "codex_cli_rs",
  };
}
