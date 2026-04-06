import { CORS_ORIGIN } from "@/shared/utils/cors";
import { handleAudioSpeech } from "@routiform/open-sse/handlers/audioSpeech.ts";
import {
  getProviderCredentials,
  clearRecoveredProviderState,
  extractApiKey,
  isValidApiKey,
} from "@/sse/services/auth";
import {
  parseSpeechModel,
  getSpeechProvider,
  buildDynamicAudioProvider,
  type ProviderNodeRow,
} from "@routiform/open-sse/config/audioRegistry.ts";
import { errorResponse } from "@routiform/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@routiform/open-sse/config/constants.ts";
import { enforceApiKeyPolicy } from "@/shared/utils/apiKeyPolicy";
import { getProviderNodes } from "@/lib/localDb";
import { v1AudioSpeechSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/**
 * POST /v1/audio/speech — text-to-speech
 * OpenAI TTS API compatible. Returns audio stream.
 */
export async function POST(request) {
  if (process.env.REQUIRE_API_KEY === "true") {
    const apiKey = extractApiKey(request);
    if (!apiKey) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Missing API key");
    const valid = await isValidApiKey(apiKey);
    if (!valid) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Invalid API key");
  }

  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid JSON body");
  }

  const validation = validateBody(v1AudioSpeechSchema, rawBody);
  if (isValidationFailure(validation)) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, validation.error.message);
  }
  const body = validation.data;

  // Enforce API key policies (model restrictions + budget limits)
  const policy = await enforceApiKeyPolicy(request, body.model);
  if (policy.rejection) return policy.rejection;

  // Load local provider_nodes for audio routing (only localhost — prevents auth bypass/SSRF)
  let dynamicProviders: ReturnType<typeof buildDynamicAudioProvider>[] = [];
  try {
    const nodes = await getProviderNodes();
    dynamicProviders = (Array.isArray(nodes) ? (nodes as unknown as ProviderNodeRow[]) : [])
      .filter((n: ProviderNodeRow) => {
        if (n.apiType !== "chat" && n.apiType !== "responses") return false;
        try {
          const hostname = new URL(n.baseUrl).hostname;
          // Strictly matching 172.16.0.0/12 (Docker/local) and explicitly blocking ::1 per SSRF hardening
          return (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
          );
        } catch {
          return false;
        }
      })
      .map((n) => buildDynamicAudioProvider(n, "/audio/speech"));
  } catch {
    // DB error — fall back to hardcoded providers only
  }

  const { provider, model: resolvedModel } = parseSpeechModel(body.model, dynamicProviders);
  if (!provider) {
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid speech model: ${body.model}. Use format: provider/model`
    );
  }

  // Check provider config — hardcoded first, then dynamic
  const providerConfig =
    getSpeechProvider(provider) || dynamicProviders.find((dp) => dp.id === provider) || null;

  // Get credentials — skip for local providers (authType: "none")
  let credentials = null;
  if (providerConfig && providerConfig.authType !== "none") {
    credentials = await getProviderCredentials(provider);
    if (!credentials) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, `No credentials for provider: ${provider}`);
    }
  }

  const response = await handleAudioSpeech({
    body,
    credentials,
    resolvedProvider: providerConfig,
    resolvedModel,
  });
  if (response?.ok) {
    await clearRecoveredProviderState(credentials);
  }
  return response;
}
