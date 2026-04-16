import { NextResponse } from "next/server";
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

    const baseUrl =
      process.env.BASE_URL ||
      (() => {
        const u = new URL(request.url);
        return `${u.protocol}//${u.host}`;
      })();

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

    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildComboTestRequestBody(model)),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      const latencyMs = Date.now() - start;
      if (isTimeoutLikeError(error)) {
        return NextResponse.json(
          {
            ok: false,
            latencyMs,
            status: 504,
            error: "Model test timeout (15s)",
          },
          { status: 504 }
        );
      }
      throw error;
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
    if (isTimeoutLikeError(err)) {
      return NextResponse.json(
        {
          ok: false,
          status: 504,
          error: "Model test timeout (15s)",
        },
        { status: 504 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
