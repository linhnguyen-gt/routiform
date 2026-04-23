import { NextResponse } from "next/server";
import { PROVIDER_MODELS } from "@/shared/constants/models";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { asRecord, getProviderBaseUrl } from "./json-utils";
import type { JsonRecord } from "./json-types";
import {
  DEFAULT_CODEX_CLIENT_VERSION,
  buildCodexModelsEndpoints,
  mapCodexModelsFromApi,
  mergeCodexModels,
  normalizeCodexModelsBaseUrl,
} from "./codex-models";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleCodexModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (ctx.provider !== "codex") return null;

  const token = ctx.accessToken || ctx.apiKey;
  if (!token) {
    return NextResponse.json(
      { error: "No access token for Codex. Please reconnect OAuth." },
      { status: 400 }
    );
  }

  const psd = asRecord(ctx.connection.providerSpecificData);
  const configuredBaseUrl =
    typeof psd.codexModelsBaseUrl === "string"
      ? psd.codexModelsBaseUrl
      : getProviderBaseUrl(ctx.connection.providerSpecificData);
  const baseUrl = normalizeCodexModelsBaseUrl(configuredBaseUrl);
  const endpoints = buildCodexModelsEndpoints(baseUrl);
  const clientVersion =
    typeof psd.codexClientVersion === "string" && psd.codexClientVersion.trim().length > 0
      ? psd.codexClientVersion.trim()
      : DEFAULT_CODEX_CLIENT_VERSION;

  let models: Array<JsonRecord> | null = null;
  let apiErrorStatus: number | null = null;

  for (const endpoint of endpoints) {
    const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}client_version=${encodeURIComponent(clientVersion)}`;
    const response = await runWithProxyContext(ctx.proxy, () =>
      safeOutboundFetch(
        url,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            Version: clientVersion,
            "Openai-Beta": "responses=experimental",
            "User-Agent": `codex-cli/${clientVersion}`,
          },
        },
        { timeoutMs: 10_000 }
      )
    ).catch(() => null);

    if (!response) continue;
    if (response.ok) {
      const payload = await response.json();
      models = mapCodexModelsFromApi(payload, !ctx.excludeHidden);
      break;
    }

    if (response.status === 401 || response.status === 403) {
      apiErrorStatus = response.status;
      break;
    }
  }

  if (!models) {
    if (apiErrorStatus === 401 || apiErrorStatus === 403) {
      return NextResponse.json(
        { error: `Auth failed: ${apiErrorStatus}` },
        { status: apiErrorStatus }
      );
    }

    const fallback = mergeCodexModels(
      (PROVIDER_MODELS.codex || []).map((m: unknown) => {
        const model = asRecord(m);
        return {
          id: model.id,
          name: model.name || model.id,
          owned_by: "codex",
        };
      })
    );

    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: fallback,
      source: "local_catalog",
      warning: "Codex API unavailable — using local catalog",
    });
  }

  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models,
    source: "api",
  });
}
