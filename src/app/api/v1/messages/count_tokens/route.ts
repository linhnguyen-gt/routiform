import { CORS_HEADERS } from "@/shared/utils/cors";
import { v1CountTokensSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { getProviderConnections, resolveProxyForProvider } from "@/lib/localDb";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { getGlmCountTokensUrls } from "@routiform/open-sse/config/glmProvider.ts";

const GLM_PROVIDER_IDS = new Set(["glm", "glmt"]);
const GLM_TOKEN_TIMEOUT_MS = 15000;

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

function estimateInputTokens(messages: Array<Record<string, unknown>>): number {
  let totalChars = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      totalChars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (
          part &&
          typeof part === "object" &&
          (part as Record<string, unknown>).type === "text" &&
          typeof (part as Record<string, unknown>).text === "string"
        ) {
          totalChars += ((part as Record<string, unknown>).text as string).length;
        }
      }
    }
  }
  return Math.ceil(totalChars / 4);
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
