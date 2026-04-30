import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { applyCustomUserAgent, toValidationErrorMessage } from "./http-utils";

export async function validateDeepgramProvider({
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

export async function validateAssemblyAIProvider({
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

export async function validateNanoBananaProvider({
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

export async function validateElevenLabsProvider({
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

export async function validateInworldProvider({
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
