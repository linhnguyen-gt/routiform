import { CORS_HEADERS } from "@/shared/utils/cors";
import { v1CountTokensSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { resolveProviderId } from "@/shared/constants/providers";
import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import {
  getApiKeyMetadata,
  getProviderConnections,
  isModelAllowedForKey,
  resolveProxyForProvider,
  validateApiKey,
} from "@/lib/localDb";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { getGlmCountTokensUrls } from "@routiform/open-sse/config/glmProvider.ts";

const GLM_PROVIDER_IDS = new Set(["glm", "glmt"]);
const GLM_TOKEN_TIMEOUT_MS = 15000;
const ANTHROPIC_COUNT_TOKENS_URL = "https://api.anthropic.com/v1/messages/count_tokens";
const ANTHROPIC_VERSION = "2023-06-01";

type CountTokensProviderCredentials = {
  apiKey?: unknown;
  allRateLimited?: unknown;
} | null;

function normalizeProvider(provider: unknown): string {
  return typeof provider === "string" ? provider.trim().toLowerCase() : "";
}

function getBodyModel(rawBody: unknown): string {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) return "";
  const model = (rawBody as Record<string, unknown>).model;
  return typeof model === "string" ? model.trim() : "";
}

function extractModelId(model: string): string {
  if (!model) return "";
  const slashIndex = model.indexOf("/");
  return slashIndex >= 0 ? model.slice(slashIndex + 1).trim() : model;
}

function shouldUseGlmCountTokens(model: string): boolean {
  const normalized = normalizeProvider(model.split("/")[0]);
  return GLM_PROVIDER_IDS.has(normalized);
}

function pickConnectionToken(connection: unknown): string | null {
  if (!connection || typeof connection !== "object") return null;
  const row = connection as Record<string, unknown>;
  const apiKey = typeof row.apiKey === "string" ? row.apiKey.trim() : "";
  if (apiKey) return apiKey;
  const accessToken = typeof row.accessToken === "string" ? row.accessToken.trim() : "";
  return accessToken || null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isConnectionRateLimited(rateLimitedUntil: unknown): boolean {
  if (typeof rateLimitedUntil !== "string" || !rateLimitedUntil.trim()) return false;
  const untilMs = new Date(rateLimitedUntil).getTime();
  return Number.isFinite(untilMs) && untilMs > Date.now();
}

function isTerminalConnectionStatus(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const normalized = status.trim().toLowerCase();
  return normalized === "credits_exhausted" || normalized === "banned" || normalized === "expired";
}

async function getProviderCredentialsReadOnly(
  providerId: string
): Promise<CountTokensProviderCredentials> {
  const providerPool =
    providerId === "anthropic"
      ? ["anthropic", "claude"]
      : providerId === "claude"
        ? ["claude", "anthropic"]
        : [providerId];

  const uniqueProviders = [...new Set(providerPool)];

  for (const provider of uniqueProviders) {
    const rows = await getProviderConnections({ provider, isActive: true });
    for (const row of rows as unknown[]) {
      const conn = row as {
        apiKey?: unknown;
        rateLimitedUntil?: unknown;
        testStatus?: unknown;
      };

      if (isConnectionRateLimited(conn.rateLimitedUntil)) continue;
      if (isTerminalConnectionStatus(conn.testStatus)) continue;

      const apiKey = toStringOrNull(conn.apiKey);
      if (apiKey) return { apiKey };
    }
  }

  return null;
}

let resolveProviderCredentials: (providerId: string) => Promise<CountTokensProviderCredentials> =
  getProviderCredentialsReadOnly;
let validateAccessKey = validateApiKey;
let validateModelAccess = isModelAllowedForKey;
let resolveAccessKeyMetadata = getApiKeyMetadata;

export function setCountTokensCredentialsResolverForTesting(
  resolver: ((providerId: string) => Promise<CountTokensProviderCredentials>) | null
) {
  resolveProviderCredentials = resolver || getProviderCredentialsReadOnly;
}

export function resetCountTokensCredentialsResolverForTesting() {
  resolveProviderCredentials = getProviderCredentialsReadOnly;
}

export function setCountTokensAccessKeyValidatorForTesting(
  validator: typeof validateApiKey | null
) {
  validateAccessKey = validator || validateApiKey;
}

export function resetCountTokensAccessKeyValidatorForTesting() {
  validateAccessKey = validateApiKey;
}

export function setCountTokensModelAccessValidatorForTesting(
  validator: typeof isModelAllowedForKey | null
) {
  validateModelAccess = validator || isModelAllowedForKey;
}

export function resetCountTokensModelAccessValidatorForTesting() {
  validateModelAccess = isModelAllowedForKey;
}

export function setCountTokensApiKeyMetadataResolverForTesting(
  resolver: typeof getApiKeyMetadata | null
) {
  resolveAccessKeyMetadata = resolver || getApiKeyMetadata;
}

export function resetCountTokensApiKeyMetadataResolverForTesting() {
  resolveAccessKeyMetadata = getApiKeyMetadata;
}

function isWithinAccessSchedule(schedule: unknown): boolean {
  const value = schedule as {
    enabled?: unknown;
    from?: unknown;
    until?: unknown;
    days?: unknown;
    tz?: unknown;
  };

  if (!value || value.enabled !== true) return true;
  if (
    typeof value.from !== "string" ||
    typeof value.until !== "string" ||
    !Array.isArray(value.days) ||
    typeof value.tz !== "string"
  ) {
    return true;
  }

  const now = new Date();
  let localTimeStr = "";
  try {
    localTimeStr = new Intl.DateTimeFormat("en-US", {
      timeZone: value.tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    return true;
  }

  const normalizedTime = localTimeStr.replace(/^24:/, "00:");
  const [localHour, localMin] = normalizedTime.split(":").map(Number);
  const localMinutes = localHour * 60 + localMin;

  let localDayStr = "";
  try {
    localDayStr = new Intl.DateTimeFormat("en-US", {
      timeZone: value.tz,
      weekday: "short",
    }).format(now);
  } catch {
    return true;
  }

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const localDay = dayMap[localDayStr] ?? now.getDay();
  const days = value.days.filter((item): item is number => typeof item === "number");
  if (!days.includes(localDay)) return false;

  const [fromHour, fromMin] = value.from.split(":").map(Number);
  const [untilHour, untilMin] = value.until.split(":").map(Number);
  const fromMinutes = fromHour * 60 + fromMin;
  const untilMinutes = untilHour * 60 + untilMin;

  if (untilMinutes < fromMinutes) {
    return localMinutes >= fromMinutes || localMinutes < untilMinutes;
  }

  return localMinutes >= fromMinutes && localMinutes < untilMinutes;
}

function estimateInputTokens(messages: unknown[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    const message = msg as { content?: unknown };
    if (typeof message.content === "string") {
      totalChars += message.content.length;
      continue;
    }

    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      const contentPart = part as { type?: unknown; text?: unknown };
      if (contentPart.type === "text" && typeof contentPart.text === "string") {
        totalChars += contentPart.text.length;
      }
    }
  }

  return Math.ceil(totalChars / 4);
}

function resolveCountProvider(modelValue: unknown): string | null {
  if (typeof modelValue !== "string") return null;
  const trimmed = modelValue.trim();
  if (!trimmed) return null;

  if (!trimmed.includes("/")) {
    return trimmed.toLowerCase().startsWith("claude") ? "claude" : null;
  }

  const providerPrefix = trimmed.split("/")[0];
  if (!providerPrefix) return null;
  return resolveProviderId(providerPrefix);
}

function normalizeUpstreamModel(modelValue: unknown): string | null {
  if (typeof modelValue !== "string") return null;
  const trimmed = modelValue.trim();
  if (!trimmed) return null;
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0) return trimmed;
  const stripped = trimmed.slice(slashIndex + 1).trim();
  return stripped || trimmed;
}

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) return token;
  }
  return null;
}

function extractAuthCandidates(request: Request): string[] {
  const candidates: string[] = [];
  const bearer = extractBearerToken(request);
  if (bearer) candidates.push(bearer);

  const xApiKey = request.headers.get("x-api-key")?.trim();
  if (xApiKey && !candidates.includes(xApiKey)) {
    candidates.push(xApiKey);
  }

  return candidates;
}

async function hasAuthorizedAuthSignal(request: Request, modelValue: unknown): Promise<boolean> {
  const model = typeof modelValue === "string" ? modelValue.trim() : "";
  if (!model) return false;

  const candidates = extractAuthCandidates(request);
  if (candidates.length === 0) return false;

  for (const accessKey of candidates) {
    try {
      const isValid = await validateAccessKey(accessKey);
      if (!isValid) continue;

      const metadata = await resolveAccessKeyMetadata(accessKey);
      if (!metadata || metadata.isActive === false) continue;
      if (!isWithinAccessSchedule(metadata.accessSchedule)) continue;

      const isAllowed = await validateModelAccess(accessKey, model);
      if (isAllowed) return true;
    } catch {
      continue;
    }
  }

  return false;
}

function supportsProviderTokenCount(provider: string | null): boolean {
  if (!provider) return false;
  return provider === "claude" || provider === "anthropic";
}

async function getProviderSideTokenCount(
  request: Request,
  body: {
    model?: unknown;
    messages: unknown[];
    system?: unknown;
  }
): Promise<number | null> {
  if (!(await hasAuthorizedAuthSignal(request, body.model))) return null;

  const provider = resolveCountProvider(body.model);
  if (!supportsProviderTokenCount(provider)) return null;

  const providerId = provider === "anthropic" ? "anthropic" : "claude";
  const model = normalizeUpstreamModel(body.model) || "";
  if (!model) return null;

  const upstreamPayload: Record<string, unknown> = {
    model,
    messages: body.messages,
  };
  if (body.system !== undefined) {
    upstreamPayload.system = body.system;
  }

  try {
    const credentials = await resolveProviderCredentials(providerId);
    if (!credentials || credentials.allRateLimited) return null;
    const apiKey =
      typeof credentials.apiKey === "string" && credentials.apiKey.trim().length > 0
        ? credentials.apiKey.trim()
        : null;
    if (!apiKey) return null;

    const response = await safeOutboundFetch(
      ANTHROPIC_COUNT_TOKENS_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(upstreamPayload),
      },
      {
        timeoutMs: 8_000,
        retries: 0,
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { input_tokens?: unknown };
    const inputTokens = data?.input_tokens;
    if (typeof inputTokens !== "number" || !Number.isFinite(inputTokens)) return null;
    return Math.max(0, Math.floor(inputTokens));
  } catch {
    return null;
  }
}

async function tryGlmCountTokens(rawBody: unknown): Promise<number | null> {
  const connections = await getProviderConnections({ isActive: true });
  const glmConnection =
    connections.find((connection: Record<string, unknown>) =>
      GLM_PROVIDER_IDS.has(normalizeProvider(connection.provider))
    ) || null;
  if (!glmConnection) return null;

  const token = pickConnectionToken(glmConnection);
  if (!token) return null;

  const providerSpecificData =
    glmConnection.providerSpecificData && typeof glmConnection.providerSpecificData === "object"
      ? glmConnection.providerSpecificData
      : {};
  const urls = getGlmCountTokensUrls(providerSpecificData);
  const model = extractModelId(getBodyModel(rawBody));
  if (!model) return null;

  const providerId = normalizeProvider(glmConnection.provider);
  const proxy = providerId ? await resolveProxyForProvider(providerId) : null;

  for (const url of urls) {
    try {
      const response = await runWithProxyContext(proxy, () =>
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model,
            messages: (rawBody as Record<string, unknown>).messages,
          }),
          signal: AbortSignal.timeout(GLM_TOKEN_TIMEOUT_MS),
        })
      );

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const candidates = [
        payload.input_tokens,
        payload.inputTokens,
        payload.total_tokens,
        payload.totalTokens,
        payload.tokens,
      ];
      for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isFinite(candidate)) {
          return Math.max(0, Math.ceil(candidate));
        }
      }
    } catch {
      // Graceful degradation to local estimate.
    }
  }

  return null;
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * POST /v1/messages/count_tokens - Mock token count response
 */
export async function POST(request) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const validation = validateBody(v1CountTokensSchema, rawBody);
  if (isValidationFailure(validation)) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  const body = validation.data;

  const providerTokenCount = await getProviderSideTokenCount(request, body);
  if (typeof providerTokenCount === "number") {
    return new Response(
      JSON.stringify({
        input_tokens: providerTokenCount,
      }),
      {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  const messages = (body.messages || []) as Array<Record<string, unknown>>;
  const requestedModel = getBodyModel(rawBody);
  let inputTokens: number;

  if (shouldUseGlmCountTokens(requestedModel)) {
    const upstreamTokens = await tryGlmCountTokens(rawBody);
    inputTokens = upstreamTokens ?? estimateInputTokens(messages);
  } else {
    inputTokens = estimateInputTokens(messages);
  }

  return new Response(
    JSON.stringify({
      input_tokens: inputTokens,
    }),
    {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    }
  );
}
