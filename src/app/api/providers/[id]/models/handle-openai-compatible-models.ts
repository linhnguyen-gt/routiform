import { NextResponse } from "next/server";
import { isOpenAICompatibleProvider } from "@/shared/constants/providers";
import { PROVIDER_MODELS } from "@/shared/constants/models";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { isOutboundUrlPolicyError, safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { asRecord, getProviderBaseUrl } from "./json-utils";
import { toModelsRouteError } from "./models-route-error";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleOpenAICompatibleModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (!isOpenAICompatibleProvider(ctx.provider)) return null;

  const baseUrl = getProviderBaseUrl(ctx.connection.providerSpecificData);
  if (!baseUrl) {
    return NextResponse.json(
      { error: "No base URL configured for OpenAI compatible provider" },
      { status: 400 }
    );
  }

  let base = baseUrl.replace(/\/$/, "");
  if (base.endsWith("/chat/completions")) {
    base = base.slice(0, -17);
  } else if (base.endsWith("/completions")) {
    base = base.slice(0, -12);
  } else if (base.endsWith("/v1")) {
    base = base.slice(0, -3);
  }

  const endpoints = [`${base}/v1/models`, `${base}/models`, `${baseUrl.replace(/\/$/, "")}/models`];

  const uniqueEndpoints = [...new Set(endpoints)];
  let models = null;
  let lastErrorStatus = null;
  let policyError: unknown = null;

  for (const modelsUrl of uniqueEndpoints) {
    try {
      const response = await runWithProxyContext(ctx.proxy, () =>
        safeOutboundFetch(
          modelsUrl,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ctx.apiKey}`,
            },
          },
          { timeoutMs: 5_000 }
        )
      );

      if (response.ok) {
        const data = await response.json();
        models = data.data || data.models || [];
        break;
      }

      if (response.status === 401 || response.status === 403) {
        lastErrorStatus = response.status;
        throw new Error("auth_failed");
      }
    } catch (err: unknown) {
      if (isOutboundUrlPolicyError(err)) {
        policyError = err;
        break;
      }
      const error = err as { message?: string };
      if (error.message === "auth_failed") break;
    }
  }

  if (!models) {
    if (policyError) {
      const mappedPolicy = toModelsRouteError(policyError);
      return NextResponse.json({ error: mappedPolicy.message }, { status: mappedPolicy.status });
    }
    if (lastErrorStatus === 401 || lastErrorStatus === 403) {
      return NextResponse.json(
        { error: `Auth failed: ${lastErrorStatus}` },
        { status: lastErrorStatus }
      );
    }

    console.warn(`[models] All endpoints failed for ${ctx.provider}, using local catalog`);
    const localModels = PROVIDER_MODELS[ctx.provider] || [];
    models = localModels.map((m: unknown) => {
      const model = asRecord(m);
      return {
        id: model.id,
        name: model.name || model.id,
        owned_by: ctx.provider,
      };
    });
  }

  const source =
    models === null || (models && models.length > 0 && models[0].owned_by === ctx.provider)
      ? "local_catalog"
      : "api";

  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models,
    source,
    ...(source === "local_catalog" ? { warning: "API unavailable — using cached catalog" } : {}),
  });
}
