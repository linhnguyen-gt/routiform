import { getRegistryEntry } from "@routiform/open-sse/config/providerRegistry.ts";
import {
  buildClaudeCodeCompatibleHeaders,
  buildClaudeCodeCompatibleValidationPayload,
  CLAUDE_CODE_COMPATIBLE_DEFAULT_CHAT_PATH,
  CLAUDE_CODE_COMPATIBLE_DEFAULT_MODELS_PATH,
  joinClaudeCodeCompatibleUrl,
  joinBaseUrlAndPath,
  stripClaudeCodeCompatibleEndpointSuffix,
  stripAnthropicMessagesSuffix,
} from "@routiform/open-sse/services/claudeCodeCompatible.ts";
import {
  isClaudeCodeCompatibleProvider,
  isAnthropicCompatibleProvider,
  isOpenAICompatibleProvider,
} from "@/shared/constants/providers";
import { isOutboundUrlPolicyError, safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { validateQoderCliPat } from "@routiform/open-sse/services/qoderCli.ts";
import {
  XIAOMI_MIMO_TOKEN_PLAN_CLUSTERS,
  normalizeXiaomiTokenPlanClusterBaseUrl,
} from "@routiform/open-sse/config/xiaomiMimoTokenPlanClusters.ts";

type JsonRecord = Record<string, unknown>;
const OPENAI_LIKE_FORMATS = new Set(["openai", "openai-responses"]);
const GEMINI_LIKE_FORMATS = new Set(["gemini", "gemini-cli"]);

function normalizeBaseUrl(baseUrl: string) {
  return (baseUrl || "").trim().replace(/\/$/, "");
}

function normalizeAnthropicBaseUrl(baseUrl: string) {
  return stripAnthropicMessagesSuffix(baseUrl || "");
}

function normalizeClaudeCodeCompatibleBaseUrl(baseUrl: string) {
  return stripClaudeCodeCompatibleEndpointSuffix(baseUrl || "");
}

function addModelsSuffix(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  const suffixes = ["/chat/completions", "/responses", "/chat", "/messages"];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      return `${normalized.slice(0, -suffix.length)}/models`;
    }
  }

  return `${normalized}/models`;
}

function resolveBaseUrl(
  entry: Record<string, unknown>,
  providerSpecificData: Record<string, unknown> = {}
) {
  if (providerSpecificData?.baseUrl && typeof providerSpecificData.baseUrl === "string") {
    return normalizeBaseUrl(providerSpecificData.baseUrl);
  }
  if (entry?.baseUrl && typeof entry.baseUrl === "string") {
    return normalizeBaseUrl(entry.baseUrl);
  }
  return "";
}

function resolveChatUrl(
  provider: string,
  baseUrl: string,
  providerSpecificData: Record<string, unknown> = {}
) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  if (isOpenAICompatibleProvider(provider)) {
    if (providerSpecificData?.chatPath) {
      return `${normalized}${providerSpecificData.chatPath}`;
    }
    if (providerSpecificData?.apiType === "responses") {
      return `${normalized}/responses`;
    }
    return `${normalized}/chat/completions`;
  }

  if (
    normalized.endsWith("/chat/completions") ||
    normalized.endsWith("/responses") ||
    normalized.endsWith("/chat")
  ) {
    return normalized;
  }

  if (normalized.endsWith("/v1")) {
    return `${normalized}/chat/completions`;
  }

  return normalized;
}

function getCustomUserAgent(providerSpecificData: Record<string, unknown> = {}) {
  if (typeof providerSpecificData?.customUserAgent !== "string") return null;
  const customUserAgent = providerSpecificData.customUserAgent.trim();
  return customUserAgent || null;
}

function applyCustomUserAgent(
  headers: Record<string, string>,
  providerSpecificData: Record<string, unknown> = {}
) {
  const customUserAgent = getCustomUserAgent(providerSpecificData);
  if (!customUserAgent) return headers;
  headers["User-Agent"] = customUserAgent;
  if ("user-agent" in headers) {
    headers["user-agent"] = customUserAgent;
  }
  return headers;
}

function withCustomUserAgent(
  init: RequestInit,
  providerSpecificData: Record<string, unknown> = {}
) {
  return {
    ...init,
    headers: applyCustomUserAgent(
      { ...((init.headers as Record<string, string> | undefined) || {}) },
      providerSpecificData
    ),
  };
}

function isTimeoutLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = (error.name || "").toLowerCase();
  const message = (error.message || "").toLowerCase();
  return (
    name === "aborterror" ||
    name === "timeouterror" ||
    message.includes("aborted due to timeout") ||
    message.includes("timeout")
  );
}

function toValidationErrorMessage(error: unknown, fallback: string): string {
  if (isOutboundUrlPolicyError(error)) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function buildBearerHeaders(apiKey: string, providerSpecificData: Record<string, unknown> = {}) {
  return applyCustomUserAgent(
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    providerSpecificData
  );
}

async function validateOpenAILikeProvider({
  provider,
  apiKey,
  baseUrl,
  providerSpecificData = {},
  modelId = "gpt-4o-mini",
  modelsUrl: customModelsUrl,
}: {
  provider: string;
  apiKey: string;
  baseUrl: string;
  providerSpecificData?: Record<string, unknown>;
  modelId?: string;
  modelsUrl?: string;
}) {
  if (!baseUrl) {
    return { valid: false, error: "Missing base URL" };
  }

  const modelsUrl = customModelsUrl || addModelsSuffix(baseUrl);
  if (!modelsUrl) {
    return { valid: false, error: "Invalid models endpoint" };
  }

  let modelsRes: Response;
  try {
    modelsRes = await safeOutboundFetch(
      modelsUrl,
      {
        method: "GET",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
      },
      { timeoutMs: 10_000 }
    );
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      return { valid: false, error: "Provider validation timeout (10s)", statusCode: 504 };
    }
    throw error;
  }

  if (modelsRes.ok) {
    return { valid: true, error: null };
  }

  if (modelsRes.status === 401 || modelsRes.status === 403) {
    return { valid: false, error: "Invalid API key" };
  }

  const chatUrl = resolveChatUrl(provider, baseUrl, providerSpecificData);
  if (!chatUrl) {
    return { valid: false, error: `Validation failed: ${modelsRes.status}` };
  }

  const testModelId =
    typeof providerSpecificData.validationModelId === "string"
      ? providerSpecificData.validationModelId
      : modelId;

  const testBody = {
    model: testModelId,
    messages: [{ role: "user", content: "test" }],
    max_tokens: 1,
  };

  let chatRes: Response;
  try {
    chatRes = await safeOutboundFetch(
      chatUrl,
      {
        method: "POST",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
        body: JSON.stringify(testBody),
      },
      { timeoutMs: 15_000 }
    );
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      return { valid: false, error: "Provider validation timeout (15s)", statusCode: 504 };
    }
    throw error;
  }

  if (chatRes.ok) {
    return { valid: true, error: null };
  }

  if (chatRes.status === 401 || chatRes.status === 403) {
    return { valid: false, error: "Invalid API key" };
  }

  if (chatRes.status === 404 || chatRes.status === 405) {
    return { valid: false, error: "Provider validation endpoint not supported" };
  }

  if (chatRes.status >= 500) {
    return { valid: false, error: `Provider unavailable (${chatRes.status})` };
  }

  // 4xx other than auth (e.g., invalid model/body) usually means auth passed.
  return { valid: true, error: null };
}

async function validateAnthropicLikeProvider({
  apiKey,
  baseUrl,
  modelId,
  headers = {},
  providerSpecificData = {},
}: {
  apiKey: string;
  baseUrl: string;
  modelId?: string;
  headers?: Record<string, string>;
  providerSpecificData?: Record<string, unknown>;
}) {
  if (!baseUrl) {
    return { valid: false, error: "Missing base URL" };
  }

  const requestHeaders = applyCustomUserAgent(
    {
      "Content-Type": "application/json",
      ...headers,
    },
    providerSpecificData
  );

  if (!requestHeaders["x-api-key"] && !requestHeaders["X-API-Key"]) {
    requestHeaders["x-api-key"] = apiKey;
  }

  if (!requestHeaders["anthropic-version"] && !requestHeaders["Anthropic-Version"]) {
    requestHeaders["anthropic-version"] = "2023-06-01";
  }

  const testModelId =
    (typeof providerSpecificData?.validationModelId === "string"
      ? providerSpecificData.validationModelId
      : null) ||
    modelId ||
    "claude-3-5-sonnet-20241022";

  const response = await safeOutboundFetch(
    baseUrl,
    {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        model: testModelId,
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      }),
    },
    { timeoutMs: 15_000 }
  );

  if (response.status === 401 || response.status === 403) {
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true, error: null };
}

async function validateGeminiLikeProvider({
  apiKey,
  baseUrl,
  authType,
  providerSpecificData = {},
}: {
  apiKey: string;
  baseUrl: string;
  authType?: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  if (!baseUrl) {
    return { valid: false, error: "Missing base URL" };
  }

  // Use the correct auth header based on provider config:
  // - gemini (API key): x-goog-api-key
  // - gemini-cli (OAuth): Bearer token
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authType === "oauth") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers["x-goog-api-key"] = apiKey;
  }
  applyCustomUserAgent(headers, providerSpecificData);

  const response = await safeOutboundFetch(
    baseUrl,
    { method: "GET", headers },
    { timeoutMs: 15_000 }
  );

  if (response.ok) {
    return { valid: true, error: null };
  }

  // 429 = rate limited, but auth is valid
  if (response.status === 429) {
    return { valid: true, error: null };
  }

  // Google returns 400 (not 401/403) for invalid API keys on the models endpoint.
  // Parse the response body to detect auth failures.
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    const isAuthError = (body: Record<string, unknown>) => {
      const errorObj = body?.error as Record<string, unknown> | undefined;
      const message = typeof errorObj?.message === "string" ? errorObj.message.toLowerCase() : "";
      const details = Array.isArray(errorObj?.details) ? errorObj.details : [];
      const reason =
        details.length > 0 && typeof details[0] === "object" && details[0] !== null
          ? (details[0] as Record<string, unknown>).reason
          : "";
      const status = typeof errorObj?.status === "string" ? errorObj.status : "";
      const authPatterns = [
        "api key not valid",
        "api key expired",
        "api key invalid",
        "API_KEY_INVALID",
        "API_KEY_EXPIRED",
        "PERMISSION_DENIED",
        "UNAUTHENTICATED",
      ];
      return authPatterns.some(
        (p) => message.includes(p.toLowerCase()) || reason === p || status === p
      );
    };

    try {
      const body = await response.json();
      if (isAuthError(body)) {
        return { valid: false, error: "Invalid API key" };
      }
      // 401/403 are always auth failures even without matching patterns
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: "Invalid API key" };
      }
    } catch {
      // Unparseable body — 401/403 are always auth failures
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: "Invalid API key" };
      }
      // 400 without parseable body — likely auth issue for Gemini
      return { valid: false, error: "Invalid API key" };
    }
  }

  return { valid: false, error: `Validation failed: ${response.status}` };
}

function parseVertexServiceAccount(apiKey: string): Record<string, unknown> | null {
  const trimmed = apiKey.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

function hasVertexServiceAccountFields(sa: Record<string, unknown>) {
  return (
    typeof sa.client_email === "string" &&
    sa.client_email.trim().length > 0 &&
    typeof sa.private_key === "string" &&
    sa.private_key.trim().length > 0
  );
}

async function validateVertexProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  const serviceAccount = parseVertexServiceAccount(apiKey);
  if (serviceAccount) {
    if (!hasVertexServiceAccountFields(serviceAccount)) {
      return {
        valid: false,
        error: "Invalid Vertex Service Account JSON (missing client_email or private_key)",
      };
    }

    return {
      valid: true,
      error: null,
      method: "service_account_json",
      warning: "Service Account JSON shape is valid; token exchange is verified at runtime",
    };
  }

  const token = apiKey.trim();
  if (!token) {
    return { valid: false, error: "Invalid API key" };
  }

  const probeProjectId =
    typeof providerSpecificData.projectId === "string" &&
    providerSpecificData.projectId.trim().length > 0
      ? providerSpecificData.projectId.trim()
      : "vertex-validation-probe";
  const probeRegion =
    typeof providerSpecificData.region === "string" && providerSpecificData.region.trim().length > 0
      ? providerSpecificData.region.trim()
      : "us-central1";
  const probeUrl = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(probeProjectId)}/locations/${encodeURIComponent(probeRegion)}/publishers/google/models/gemini-2.5-flash:generateContent`;

  const probeBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "test" }] }],
    generationConfig: { maxOutputTokens: 1 },
  });

  const classifyProbeResponse = async (response: Response) => {
    if (response.status === 401) {
      return { valid: false, authRejected: true };
    }

    if (response.status === 403) {
      let bodyText = "";
      try {
        bodyText = (await response.text()).toLowerCase();
      } catch {
        bodyText = "";
      }

      const looksLikeAuthFailure =
        bodyText.includes("api key not valid") ||
        bodyText.includes("invalid authentication") ||
        bodyText.includes("unauthenticated");

      if (looksLikeAuthFailure) {
        return { valid: false, authRejected: true };
      }

      return {
        valid: true,
        warning: "Credentials accepted but missing project/model permission for validation probe",
      };
    }

    if (response.status >= 500) {
      return { valid: false, upstream: true, status: response.status };
    }

    if (response.ok) {
      return { valid: true };
    }

    // Non-auth 4xx (400/404/405/409/422/429) means the upstream accepted auth and
    // rejected request/project/model shape.
    return { valid: true, warning: "Credentials accepted; request probe returned non-auth status" };
  };

  const probeVertexAuth = async (headers: Record<string, string>) => {
    const response = await fetch(
      probeUrl,
      withCustomUserAgent(
        {
          method: "POST",
          headers,
          body: probeBody,
        },
        providerSpecificData
      )
    );
    return classifyProbeResponse(response);
  };

  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(
      url,
      withCustomUserAgent(
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
        providerSpecificData
      )
    );

    if (response.ok) {
      const body = (await response.json()) as Record<string, unknown>;
      const scope = typeof body.scope === "string" ? body.scope : "";
      const hasCloudScope =
        scope.includes("https://www.googleapis.com/auth/cloud-platform") ||
        scope.includes("https://www.googleapis.com/auth/cloud-platform.read-only");

      return {
        valid: true,
        error: null,
        method: "oauth_token_info",
        warning: hasCloudScope ? null : "Access token may be missing cloud-platform scope",
      };
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      // Some Vertex credential forms (especially API-key style values used with OpenAPI endpoints)
      // are not introspectable via tokeninfo. Probe Vertex inference endpoint directly before rejecting.
      try {
        const bearerProbe = await probeVertexAuth({
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        });
        if (bearerProbe.valid) {
          return {
            valid: true,
            error: null,
            method: "vertex_inference_probe_bearer",
            warning: bearerProbe.warning || null,
          };
        }

        const apiKeyProbe = await probeVertexAuth({
          "Content-Type": "application/json",
          "x-goog-api-key": token,
        });
        if (apiKeyProbe.valid) {
          return {
            valid: true,
            error: null,
            method: "vertex_inference_probe_apikey",
            warning: apiKeyProbe.warning || null,
          };
        }

        if (bearerProbe.authRejected && apiKeyProbe.authRejected) {
          return { valid: false, error: "Invalid API key" };
        }

        const upstreamStatus =
          (typeof bearerProbe.status === "number" && bearerProbe.status) ||
          (typeof apiKeyProbe.status === "number" && apiKeyProbe.status) ||
          null;
        if (upstreamStatus) {
          return { valid: false, error: `Provider unavailable (${upstreamStatus})` };
        }

        return {
          valid: false,
          error:
            "Validation inconclusive for Vertex credentials (check project/region or try runtime test)",
        };
      } catch (probeError: unknown) {
        return {
          valid: false,
          error: probeError instanceof Error ? probeError.message : "Validation failed",
        };
      }
    }

    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

// ── Specialty providers (non-standard APIs) ──

async function validateDeepgramProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  try {
    const response = await safeOutboundFetch(
      "https://api.deepgram.com/v1/auth/token",
      {
        method: "GET",
        headers: applyCustomUserAgent({ Authorization: `Token ${apiKey}` }, providerSpecificData),
      },
      { timeoutMs: 10_000 }
    );
    if (response.ok) return { valid: true, error: null };
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Validation failed") };
  }
}

async function validateAssemblyAIProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  try {
    const response = await safeOutboundFetch(
      "https://api.assemblyai.com/v2/transcript?limit=1",
      {
        method: "GET",
        headers: applyCustomUserAgent(
          {
            Authorization: apiKey,
            "Content-Type": "application/json",
          },
          providerSpecificData
        ),
      },
      { timeoutMs: 10_000 }
    );
    if (response.ok) return { valid: true, error: null };
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Validation failed") };
  }
}

async function validateNanoBananaProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  try {
    // NanoBanana doesn't expose a lightweight validation endpoint,
    // so we send a minimal generate request that will succeed or fail on auth.
    const response = await safeOutboundFetch(
      "https://api.nanobananaapi.ai/api/v1/nanobanana/generate",
      {
        method: "POST",
        headers: applyCustomUserAgent(
          {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          providerSpecificData
        ),
        body: JSON.stringify({
          prompt: "test",
          model: "nanobanana-flash",
        }),
      },
      { timeoutMs: 15_000 }
    );
    // Auth errors → 401/403; anything else (even 400 bad request) means auth passed
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    return { valid: true, error: null };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Validation failed") };
  }
}

async function validateElevenLabsProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  try {
    // Lightweight auth check endpoint
    const response = await safeOutboundFetch(
      "https://api.elevenlabs.io/v1/voices",
      {
        method: "GET",
        headers: applyCustomUserAgent(
          {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          providerSpecificData
        ),
      },
      { timeoutMs: 10_000 }
    );

    if (response.ok) return { valid: true, error: null };
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Validation failed") };
  }
}

async function validateInworldProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  try {
    // Inworld TTS lacks a simple key-introspection endpoint.
    // Send a minimal synth request and treat non-auth 4xx as auth-pass.
    const response = await safeOutboundFetch(
      "https://api.inworld.ai/tts/v1/voice",
      {
        method: "POST",
        headers: applyCustomUserAgent(
          {
            Authorization: `Basic ${apiKey}`,
            "Content-Type": "application/json",
          },
          providerSpecificData
        ),
        body: JSON.stringify({
          text: "test",
          modelId: "inworld-tts-1.5-mini",
          audioConfig: { audioEncoding: "MP3" },
        }),
      },
      { timeoutMs: 15_000 }
    );

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    // Any other response indicates auth is accepted (payload/model may still be wrong)
    return { valid: true, error: null };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Validation failed") };
  }
}

async function validateBailianCodingPlanProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  try {
    const rawBaseUrl =
      (typeof providerSpecificData.baseUrl === "string"
        ? normalizeBaseUrl(providerSpecificData.baseUrl)
        : null) || "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic/v1";
    const baseUrl = rawBaseUrl.endsWith("/messages")
      ? rawBaseUrl.slice(0, -"/messages".length)
      : rawBaseUrl;
    // bailian-coding-plan uses DashScope Anthropic-compatible messages endpoint
    // It does NOT expose /v1/models — use messages probe directly
    const messagesUrl = `${baseUrl}/messages`;

    const response = await safeOutboundFetch(
      messagesUrl,
      {
        method: "POST",
        headers: applyCustomUserAgent(
          {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          providerSpecificData
        ),
        body: JSON.stringify({
          model: "qwen3-coder-plus",
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
      },
      { timeoutMs: 15_000 }
    );

    // 401/403 => invalid key
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    // Non-auth 4xx (e.g., 400 bad request) means auth passed but request was malformed
    if (response.status >= 400 && response.status < 500) {
      return { valid: true, error: null };
    }

    if (response.ok) {
      return { valid: true, error: null };
    }

    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Validation failed") };
  }
}

async function validateOpenAICompatibleProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  const baseUrl =
    typeof providerSpecificData.baseUrl === "string"
      ? normalizeBaseUrl(providerSpecificData.baseUrl)
      : "";
  if (!baseUrl) {
    return { valid: false, error: "No base URL configured for OpenAI compatible provider" };
  }

  const validationModelId =
    typeof providerSpecificData?.validationModelId === "string"
      ? providerSpecificData.validationModelId.trim()
      : "";

  // Step 1: Try GET /models
  let modelsReachable = false;
  try {
    const modelsRes = await safeOutboundFetch(
      `${baseUrl}/models`,
      {
        method: "GET",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
      },
      { timeoutMs: 10_000 }
    );

    modelsReachable = true;

    if (modelsRes.ok) {
      return { valid: true, error: null, method: "models_endpoint" };
    }

    if (modelsRes.status === 401 || modelsRes.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    // Endpoint responded and auth seems valid, but quota is exhausted/rate-limited.
    if (modelsRes.status === 429) {
      return {
        valid: true,
        error: null,
        method: "models_endpoint",
        warning: "Rate limited, but credentials are valid",
      };
    }
  } catch (error: unknown) {
    if (isOutboundUrlPolicyError(error)) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
      };
    }
    // /models fetch failed (network error, etc.) — fall through to chat test
  }

  // T25: if /models cannot be used and no custom model was provided, return a
  // clear actionable message instead of a generic connection error.
  if (!validationModelId) {
    return {
      valid: false,
      error: "Endpoint /models unavailable. Provide a Model ID to validate via /chat/completions.",
    };
  }

  // Step 2: Fallback — try a minimal chat completion request
  // Many providers don't expose /models but accept chat completions fine
  const apiType =
    typeof providerSpecificData.apiType === "string" ? providerSpecificData.apiType : "chat";
  const chatSuffix = apiType === "responses" ? "/responses" : "/chat/completions";
  const chatUrl = `${baseUrl}${chatSuffix}`;
  const testModelId = validationModelId;

  try {
    const chatRes = await safeOutboundFetch(
      chatUrl,
      {
        method: "POST",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
        body: JSON.stringify({
          model: testModelId,
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1,
        }),
      },
      { timeoutMs: 15_000 }
    );

    if (chatRes.ok) {
      return { valid: true, error: null, method: "chat_completions" };
    }

    if (chatRes.status === 401 || chatRes.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    if (chatRes.status === 429) {
      return {
        valid: true,
        error: null,
        method: "chat_completions",
        warning: "Rate limited, but credentials are valid",
      };
    }

    // If /models was reachable but returned non-auth error, and chat succeeds
    // auth-wise, this still confirms credentials are valid.
    if (chatRes.status === 400) {
      return {
        valid: true,
        error: null,
        method: "inference_available",
        warning: "Model ID may be invalid, but credentials are valid",
      };
    }

    // 4xx other than auth (e.g. 400 bad model, 422) usually means auth passed
    if (chatRes.status >= 400 && chatRes.status < 500) {
      return {
        valid: true,
        error: null,
        method: "inference_available",
      };
    }

    if (chatRes.status >= 500) {
      return { valid: false, error: `Provider unavailable (${chatRes.status})` };
    }
  } catch {
    // Chat test also failed — fall through to simple connectivity check
  }

  // Step 3: Final fallback — simple connectivity check
  // For local providers (Ollama, LM Studio, etc.) that may not respond to
  // standard OpenAI endpoints but are still reachable
  if (!modelsReachable) {
    return { valid: false, error: "Connection failed while testing /chat/completions" };
  }

  try {
    const pingRes = await safeOutboundFetch(
      baseUrl,
      {
        method: "GET",
        headers: buildBearerHeaders(apiKey, providerSpecificData),
      },
      { timeoutMs: 5_000 }
    );

    // If the server responds at all (even with an error page), it's reachable
    if (pingRes.status < 500) {
      return { valid: true, error: null };
    }

    return { valid: false, error: `Provider unavailable (${pingRes.status})` };
  } catch (error: unknown) {
    return {
      valid: false,
      error: toValidationErrorMessage(error, "Connection failed"),
    };
  }
}

async function validateAnthropicCompatibleProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  let baseUrl =
    typeof providerSpecificData.baseUrl === "string"
      ? normalizeAnthropicBaseUrl(providerSpecificData.baseUrl)
      : "";
  if (!baseUrl) {
    return { valid: false, error: "No base URL configured for Anthropic compatible provider" };
  }

  const headers = applyCustomUserAgent(
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      Authorization: `Bearer ${apiKey}`,
    },
    providerSpecificData
  );

  // Step 1: Try GET /models
  try {
    const modelsPath =
      typeof providerSpecificData?.modelsPath === "string"
        ? providerSpecificData.modelsPath
        : "/models";
    const modelsRes = await safeOutboundFetch(
      joinBaseUrlAndPath(baseUrl, modelsPath),
      {
        method: "GET",
        headers,
      },
      { timeoutMs: 10_000 }
    );

    if (modelsRes.ok) {
      return { valid: true, error: null };
    }

    if (modelsRes.status === 401 || modelsRes.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
  } catch (error: unknown) {
    if (isOutboundUrlPolicyError(error)) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
      };
    }
    // /models fetch failed — fall through to messages test
  }

  // Step 2: Fallback — try a minimal messages request
  const testModelId =
    typeof providerSpecificData?.validationModelId === "string"
      ? providerSpecificData.validationModelId
      : "claude-3-5-sonnet-20241022";
  try {
    const chatPath =
      typeof providerSpecificData?.chatPath === "string"
        ? providerSpecificData.chatPath
        : "/messages";
    const messagesRes = await safeOutboundFetch(
      joinBaseUrlAndPath(baseUrl, chatPath),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: testModelId,
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
      },
      { timeoutMs: 15_000 }
    );

    if (messagesRes.status === 401 || messagesRes.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    // Any other response (200, 400, 422, etc.) means auth passed
    return { valid: true, error: null };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Connection failed") };
  }
}

export async function validateClaudeCodeCompatibleProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  const baseUrl =
    typeof providerSpecificData.baseUrl === "string"
      ? normalizeClaudeCodeCompatibleBaseUrl(providerSpecificData.baseUrl)
      : "";
  if (!baseUrl) {
    return { valid: false, error: "No base URL configured for CC Compatible provider" };
  }

  const modelsPath =
    typeof providerSpecificData?.modelsPath === "string"
      ? providerSpecificData.modelsPath
      : CLAUDE_CODE_COMPATIBLE_DEFAULT_MODELS_PATH;
  const chatPath =
    typeof providerSpecificData?.chatPath === "string"
      ? providerSpecificData.chatPath
      : CLAUDE_CODE_COMPATIBLE_DEFAULT_CHAT_PATH;
  const defaultHeaders = applyCustomUserAgent(
    buildClaudeCodeCompatibleHeaders(apiKey, false),
    providerSpecificData
  );

  try {
    const modelsRes = await safeOutboundFetch(
      joinClaudeCodeCompatibleUrl(baseUrl, modelsPath),
      {
        method: "GET",
        headers: defaultHeaders,
      },
      { timeoutMs: 10_000 }
    );

    if (modelsRes.ok) {
      return { valid: true, error: null, method: "models_endpoint" };
    }

    if (modelsRes.status === 401 || modelsRes.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
  } catch (error: unknown) {
    if (isOutboundUrlPolicyError(error)) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
      };
    }
    // Fall through to bridge request validation.
  }

  const payload = buildClaudeCodeCompatibleValidationPayload(
    typeof providerSpecificData?.validationModelId === "string"
      ? providerSpecificData.validationModelId
      : "claude-sonnet-4-6"
  );
  const sessionId = JSON.parse(payload.metadata.user_id).session_id;

  try {
    const messagesRes = await safeOutboundFetch(
      joinClaudeCodeCompatibleUrl(baseUrl, chatPath),
      {
        method: "POST",
        headers: applyCustomUserAgent(
          buildClaudeCodeCompatibleHeaders(apiKey, true, sessionId),
          providerSpecificData
        ),
        body: JSON.stringify(payload),
      },
      { timeoutMs: 15_000 }
    );

    if (messagesRes.status === 401 || messagesRes.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    if (messagesRes.status === 429) {
      return {
        valid: true,
        error: null,
        method: "cc_bridge_request",
        warning: "Rate limited, but credentials are valid",
      };
    }

    if (messagesRes.status >= 400 && messagesRes.status < 500) {
      return {
        valid: true,
        error: null,
        method: "cc_bridge_request",
        warning: "Bridge request reached upstream, but the model or payload was rejected",
      };
    }

    return {
      valid: messagesRes.ok,
      error: messagesRes.ok ? null : `Validation failed: ${messagesRes.status}`,
      method: "cc_bridge_request",
    };
  } catch (error: unknown) {
    return { valid: false, error: toValidationErrorMessage(error, "Connection failed") };
  }
}

// ── Search provider validators (factored) ──

async function validateSearchProvider(
  url: string,
  init: RequestInit,
  providerSpecificData: Record<string, unknown> = {}
): Promise<{ valid: boolean; error: string | null; unsupported?: false }> {
  try {
    const response = await safeOutboundFetch(url, withCustomUserAgent(init, providerSpecificData), {
      timeoutMs: 10_000,
    });
    if (response.ok) return { valid: true, error: null, unsupported: false };
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key", unsupported: false };
    }
    // For provider setup we only need to confirm authentication passed.
    // Search providers may return non-auth statuses for exhausted credits,
    // rate limiting, or request-shape quirks while still accepting the key.
    if (response.status < 500) {
      return { valid: true, error: null, unsupported: false };
    }
    return { valid: false, error: `Validation failed: ${response.status}`, unsupported: false };
  } catch (error: unknown) {
    if (isTimeoutLikeError(error)) {
      return {
        valid: false,
        error: "Provider validation timeout",
        unsupported: false,
      };
    }
    return {
      valid: false,
      error: toValidationErrorMessage(error, "Validation failed"),
      unsupported: false,
    };
  }
}

const SEARCH_VALIDATOR_CONFIGS: Record<
  string,
  (apiKey: string) => { url: string; init: RequestInit }
> = {
  "serper-search": (apiKey) => ({
    url: "https://google.serper.dev/search",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ q: "test", num: 1 }),
    },
  }),
  "brave-search": (apiKey) => ({
    url: "https://api.search.brave.com/res/v1/web/search?q=test&count=1",
    init: {
      method: "GET",
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    },
  }),
  "perplexity-search": (apiKey) => ({
    url: "https://api.perplexity.ai/search",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query: "test", max_results: 1 }),
    },
  }),
  "exa-search": (apiKey) => ({
    url: "https://api.exa.ai/search",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ query: "test", numResults: 1 }),
    },
  }),
  "tavily-search": (apiKey) => ({
    url: "https://api.tavily.com/search",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query: "test", max_results: 1 }),
    },
  }),
};

export async function validateProviderApiKey({
  provider,
  apiKey,
  providerSpecificData = {},
}: {
  provider: string;
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  if (!provider || !apiKey) {
    return { valid: false, error: "Provider and API key required", unsupported: false };
  }

  if (isOpenAICompatibleProvider(provider)) {
    try {
      return await validateOpenAICompatibleProvider({ apiKey, providerSpecificData });
    } catch (error: unknown) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
        unsupported: false,
      };
    }
  }

  if (isAnthropicCompatibleProvider(provider)) {
    try {
      if (isClaudeCodeCompatibleProvider(provider)) {
        return await validateClaudeCodeCompatibleProvider({ apiKey, providerSpecificData });
      }
      return await validateAnthropicCompatibleProvider({ apiKey, providerSpecificData });
    } catch (error: unknown) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
        unsupported: false,
      };
    }
  }

  const SPECIALTY_VALIDATORS: Record<
    string,
    (params: Record<string, unknown>) => Promise<{
      valid: boolean;
      error: string | null;
      unsupported?: boolean;
      method?: string;
      warning?: string;
    }>
  > = {
    qoder: ({ apiKey, providerSpecificData }: Record<string, unknown>) =>
      validateQoderCliPat({
        apiKey: String(apiKey || ""),
        providerSpecificData: providerSpecificData as JsonRecord,
      }),
    deepgram: validateDeepgramProvider,
    assemblyai: validateAssemblyAIProvider,
    nanobanana: validateNanoBananaProvider,
    elevenlabs: validateElevenLabsProvider,
    inworld: validateInworldProvider,
    "bailian-coding-plan": validateBailianCodingPlanProvider,
    vertex: validateVertexProvider,
    nvidia: async ({ apiKey, providerSpecificData: psd }: Record<string, unknown>) => {
      const providerSpecificData = (psd || {}) as Record<string, unknown>;
      try {
        const baseUrl =
          typeof providerSpecificData.baseUrl === "string"
            ? normalizeBaseUrl(providerSpecificData.baseUrl)
            : "https://integrate.api.nvidia.com/v1";
        const res = await safeOutboundFetch(
          `${baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: buildBearerHeaders(String(apiKey || ""), providerSpecificData as JsonRecord),
            body: JSON.stringify({
              model: "meta/llama-3.3-70b-instruct",
              messages: [{ role: "user", content: "test" }],
              max_tokens: 1,
            }),
          },
          { timeoutMs: 15_000 }
        );
        if (res.status === 401 || res.status === 403) {
          return { valid: false, error: "Invalid API key" };
        }

        if (res.status === 404 || res.status === 405) {
          return {
            valid: false,
            error: "NVIDIA validation endpoint not found (check base URL and endpoint)",
          };
        }

        if (res.status >= 500) {
          return { valid: false, error: `NVIDIA upstream unavailable (${res.status})` };
        }

        if (!res.ok) {
          return { valid: false, error: `NVIDIA validation failed (${res.status})` };
        }

        return { valid: true, error: null };
      } catch (error: unknown) {
        return {
          valid: false,
          error: toValidationErrorMessage(error, "Connection failed"),
        };
      }
    },
    // LongCat AI — does not expose /v1/models; validate via chat completions directly (#592)
    longcat: async ({ apiKey, providerSpecificData }: Record<string, unknown>) => {
      try {
        const res = await safeOutboundFetch(
          "https://api.longcat.chat/openai/v1/chat/completions",
          {
            method: "POST",
            headers: buildBearerHeaders(String(apiKey || ""), providerSpecificData as JsonRecord),
            body: JSON.stringify({
              model: "longcat",
              messages: [{ role: "user", content: "test" }],
              max_tokens: 1,
            }),
          },
          { timeoutMs: 15_000 }
        );
        if (res.status === 401 || res.status === 403) {
          return { valid: false, error: "Invalid API key" };
        }
        // Any non-auth response (200, 400, 422) means auth passed
        return { valid: true, error: null };
      } catch (error: unknown) {
        return {
          valid: false,
          error: toValidationErrorMessage(error, "Connection failed"),
        };
      }
    },
    "xiaomi-mimo-token-plan": async ({
      apiKey,
      providerSpecificData: psd,
    }: Record<string, unknown>) => {
      const providerSpecificData = (psd || {}) as Record<string, unknown>;
      const raw =
        typeof providerSpecificData.baseUrl === "string" ? providerSpecificData.baseUrl.trim() : "";
      if (!raw) {
        return {
          valid: false,
          error: "Select a Token Plan cluster (China, Singapore, or Europe).",
        };
      }
      const root = normalizeXiaomiTokenPlanClusterBaseUrl(raw);
      const allowed = new Set<string>(XIAOMI_MIMO_TOKEN_PLAN_CLUSTERS.map((c) => c.baseUrl));
      if (!root || !allowed.has(root)) {
        return {
          valid: false,
          error: "Unknown cluster; pick China, Singapore, or Europe (cluster root only).",
        };
      }
      const baseUrl = `${root}/v1`;
      return validateOpenAILikeProvider({
        provider: "xiaomi-mimo-token-plan",
        apiKey: String(apiKey || ""),
        baseUrl,
        providerSpecificData,
        modelId: "mimo-v2-pro",
      });
    },
    // Search providers — use factored validator
    ...Object.fromEntries(
      Object.entries(SEARCH_VALIDATOR_CONFIGS).map(([id, configFn]) => [
        id,
        ({ apiKey, providerSpecificData }: Record<string, unknown>) => {
          const { url, init } = configFn(String(apiKey || ""));
          return validateSearchProvider(url, init, providerSpecificData as JsonRecord);
        },
      ])
    ),
  };

  if (SPECIALTY_VALIDATORS[provider]) {
    try {
      return await SPECIALTY_VALIDATORS[provider]({ apiKey, providerSpecificData });
    } catch (error: unknown) {
      return {
        valid: false,
        error: toValidationErrorMessage(error, "Validation failed"),
        unsupported: false,
      };
    }
  }

  const entry = getRegistryEntry(provider);
  if (!entry) {
    return { valid: false, error: "Provider validation not supported", unsupported: true };
  }

  const entryRecord = entry as unknown as Record<string, unknown>;
  const models = Array.isArray(entryRecord.models) ? entryRecord.models : [];
  const firstModel = models[0] as Record<string, unknown> | undefined;
  const modelId = firstModel?.id ? String(firstModel.id) : null;
  // Use testKeyBaseUrl if defined — validation base can differ from the registry chat base.
  const validationEntry = entryRecord.testKeyBaseUrl
    ? { ...entry, baseUrl: entryRecord.testKeyBaseUrl }
    : entry;
  const baseUrl = resolveBaseUrl(
    validationEntry as unknown as Record<string, unknown>,
    providerSpecificData as Record<string, unknown>
  );

  try {
    const format = typeof entryRecord.format === "string" ? entryRecord.format : "";
    if (OPENAI_LIKE_FORMATS.has(format)) {
      return await validateOpenAILikeProvider({
        provider,
        apiKey,
        baseUrl,
        providerSpecificData,
        modelId: modelId || undefined,
        modelsUrl: typeof entryRecord.modelsUrl === "string" ? entryRecord.modelsUrl : undefined,
      });
    }

    if (format === "claude") {
      const urlSuffix = typeof entryRecord.urlSuffix === "string" ? entryRecord.urlSuffix : "";
      const requestBaseUrl = `${baseUrl}${urlSuffix}`;
      const requestHeaders: Record<string, string> = {
        ...(entryRecord.headers && typeof entryRecord.headers === "object"
          ? (entryRecord.headers as Record<string, string>)
          : {}),
      };

      const authHeader =
        typeof entryRecord.authHeader === "string" ? entryRecord.authHeader.toLowerCase() : "";
      if (authHeader === "x-api-key") {
        requestHeaders["x-api-key"] = apiKey;
      } else {
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
      }

      return await validateAnthropicLikeProvider({
        apiKey,
        baseUrl: requestBaseUrl,
        modelId: modelId || undefined,
        headers: requestHeaders,
        providerSpecificData,
      });
    }

    if (GEMINI_LIKE_FORMATS.has(format)) {
      return await validateGeminiLikeProvider({
        apiKey,
        baseUrl,
        providerSpecificData,
        authType: typeof entryRecord.authType === "string" ? entryRecord.authType : undefined,
      });
    }

    return { valid: false, error: "Provider validation not supported", unsupported: true };
  } catch (error: unknown) {
    return {
      valid: false,
      error: toValidationErrorMessage(error, "Validation failed"),
      unsupported: false,
    };
  }
}
