import { FORMATS } from "../../translator/formats.ts";

export function shouldUseNativeCodexPassthrough({
  provider,
  sourceFormat,
  endpointPath,
}: {
  provider?: string | null;
  sourceFormat?: string | null;
  endpointPath?: string | null;
}): boolean {
  if (provider !== "codex") return false;
  if (sourceFormat !== FORMATS.OPENAI_RESPONSES) return false;
  let normalizedEndpoint = String(endpointPath || "");
  while (normalizedEndpoint.endsWith("/")) normalizedEndpoint = normalizedEndpoint.slice(0, -1);
  const segments = normalizedEndpoint.split("/");
  return segments.includes("responses");
}

/**
 * Claude Code hits POST /v1/messages → we translate claude→openai before GitHub Copilot.
 * OpenCode hits POST /v1/chat/completions → source/target are both OpenAI (near-passthrough),
 * so the upstream payload can differ and Copilot returns opaque 400. Round-trip through
 * Anthropic-shaped messages so the GitHub executor sees the same shape as Messages clients.
 */
/** @internal Exported for unit tests */
export function shouldBridgeGithubClaudeOpenAiThroughClaudeFormat(
  provider: string,
  sourceFormat: string,
  targetFormat: string,
  resolvedModelId: string
): boolean {
  if (provider !== "github") return false;
  if (sourceFormat !== FORMATS.OPENAI || targetFormat !== FORMATS.OPENAI) return false;
  const m = (resolvedModelId || "").toLowerCase();
  if (!m.includes("claude-")) return false;
  if (/(^|-)codex($|-)/.test(m)) return false;
  return true;
}

/** @internal Exported for unit tests */
export function sanitizeGithubInitiatorHeaderValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 64) return null;
  if (/[^a-zA-Z0-9._-]/.test(value)) return null;
  return value;
}

export function toPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Check if token is expired or about to expire
 */
export function isTokenExpiringSoon(expiresAt: unknown, bufferMs = 5 * 60 * 1000) {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt as string | number | Date).getTime();
  return expiresAtMs - Date.now() < bufferMs;
}
