import { NextResponse } from "next/server";
import { initTranslators } from "@routiform/open-sse/translator/index.ts";
import { handleChat } from "@/sse/handlers/chat";
import {
  buildComboTestRequestBody,
  extractComboTestProviderStatusError,
  extractComboTestResponseText,
  extractComboTestUpstreamError,
  isComboTestErrorLikeText,
  parseComboTestHttpPayload,
} from "@/lib/combos/testHealth";
import { getApiKeys } from "@/models";
import { modelTestRouteSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

export const dynamic = "force-dynamic";

const MODEL_TEST_TIMEOUT_MS = 30_000;
let translatorInitPromise: Promise<void> | null = null;

function modelTestTimeoutMessage(): string {
  return `Model test timeout (${Math.trunc(MODEL_TEST_TIMEOUT_MS / 1000)}s)`;
}

function modelTestUsesHttpFetch(): boolean {
  return process.env.ROUTIFORM_MODEL_TEST_USE_FETCH === "1";
}

function resolveModelTestExternalBaseUrl(requestOrigin: string): string {
  const rawBaseUrl = (process.env.BASE_URL || "").trim();
  if (!rawBaseUrl) return requestOrigin;
  try {
    const configured = new URL(rawBaseUrl);
    const request = new URL(requestOrigin);
    if (configured.origin !== request.origin) {
      return requestOrigin;
    }
    return configured.origin;
  } catch {
    return requestOrigin;
  }
}

function ensureTranslatorsForModelTest(): Promise<void> {
  if (!translatorInitPromise) {
    translatorInitPromise = Promise.resolve(initTranslators()).catch((error) => {
      translatorInitPromise = null;
      throw error;
    });
  }
  return translatorInitPromise;
}

function createTimeoutError(): Error {
  const error = new Error(modelTestTimeoutMessage());
  error.name = "TimeoutError";
  return error;
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

/**
 * POST /api/models/test — Send a minimal chat completion via the unified API to verify routing for a model id.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const validation = validateBody(modelTestRouteSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json(validation.error, { status: 400 });
    }
    const { model } = validation.data;

    const requestOrigin = (() => {
      const u = new URL(request.url);
      return `${u.protocol}//${u.host}`;
    })();
    const externalBaseUrl = resolveModelTestExternalBaseUrl(requestOrigin);
    const externalChatCompletionsUrl = `${externalBaseUrl}/api/v1/chat/completions`;
    const internalChatCompletionsUrl = `${requestOrigin}/api/v1/chat/completions`;

    let apiKey: string | null = null;
    try {
      const keys = await getApiKeys();
      const rawKey = keys.find((k) => k.isActive !== false)?.key;
      apiKey = typeof rawKey === "string" ? rawKey : null;
    } catch {
      // optional auth
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    headers.Accept = "application/json";
    headers["X-Internal-Test"] = "combo-health-check";
    headers["X-Routiform-No-Cache"] = "true";
    const requestBody = JSON.stringify(buildComboTestRequestBody(model));

    const start = Date.now();
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(createTimeoutError());
      }, MODEL_TEST_TIMEOUT_MS);
    });
    let res: Response;
    try {
      if (modelTestUsesHttpFetch()) {
        res = await Promise.race([
          fetch(externalChatCompletionsUrl, {
            method: "POST",
            headers,
            body: requestBody,
            signal: controller.signal,
          }),
          timeoutPromise,
        ]);
      } else {
        await ensureTranslatorsForModelTest();
        const internalRequest = new Request(internalChatCompletionsUrl, {
          method: "POST",
          headers,
          body: requestBody,
          signal: controller.signal,
        });
        res = await Promise.race([handleChat(internalRequest), timeoutPromise]);
      }
    } catch (error) {
      const latencyMs = Date.now() - start;
      if (isTimeoutLikeError(error)) {
        return NextResponse.json(
          {
            ok: false,
            latencyMs,
            status: 504,
            error: modelTestTimeoutMessage(),
          },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
    const latencyMs = Date.now() - start;

    const rawText = await res.text().catch(() => "");
    const parsedPayload = parseComboTestHttpPayload(
      rawText,
      model,
      res.headers.get("content-type") || ""
    );
    const parsed =
      parsedPayload && typeof parsedPayload === "object" && !Array.isArray(parsedPayload)
        ? (parsedPayload as Record<string, unknown>)
        : null;

    if (!res.ok) {
      const detail = extractComboTestUpstreamError(parsedPayload, "") || rawText;
      const error = `HTTP ${res.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`;
      return NextResponse.json({ ok: false, latencyMs, error, status: res.status });
    }

    const providerStatusError = extractComboTestProviderStatusError(parsedPayload);
    if (providerStatusError) {
      return NextResponse.json({
        ok: false,
        latencyMs,
        status: res.status,
        error: String(providerStatusError).slice(0, 240),
      });
    }

    if (parsed?.error) {
      const providerError = extractComboTestUpstreamError(parsed, "Provider returned an error");
      return NextResponse.json({
        ok: false,
        latencyMs,
        status: res.status,
        error: String(providerError).slice(0, 240),
      });
    }

    const responseText = extractComboTestResponseText(parsedPayload, model);
    if (!responseText) {
      const embeddedError = extractComboTestUpstreamError(parsedPayload, "");
      return NextResponse.json({
        ok: false,
        latencyMs,
        status: res.status,
        error:
          embeddedError ||
          "Provider returned HTTP 200 but no assistant text (empty or unsupported response shape).",
      });
    }

    if (isComboTestErrorLikeText(responseText)) {
      return NextResponse.json({
        ok: false,
        latencyMs,
        status: res.status,
        error: responseText.slice(0, 240),
      });
    }

    return NextResponse.json({ ok: true, latencyMs, error: null, status: res.status });
  } catch (err) {
    const latencyMs = 0;
    if (isTimeoutLikeError(err)) {
      return NextResponse.json(
        {
          ok: false,
          latencyMs,
          status: 504,
          error: modelTestTimeoutMessage(),
        },
        { status: 504 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
