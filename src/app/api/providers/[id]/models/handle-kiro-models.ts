import { NextResponse } from "next/server";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { asRecord, getProviderBaseUrl } from "./json-utils";
import {
  buildKiroModelsEndpoint,
  mapKiroModelsFromApi,
  mergeKiroModels,
  normalizeKiroBaseUrl,
} from "./kiro-models";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

function buildKiroFallbackModels() {
  return mergeKiroModels([]);
}

export async function handleKiroModels(ctx: GetModelsHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "kiro") return null;

  const token = ctx.accessToken || ctx.apiKey;
  if (!token) {
    return NextResponse.json(
      { error: "No access token for Kiro. Please reconnect OAuth." },
      { status: 400 }
    );
  }

  const psd = asRecord(ctx.connection.providerSpecificData);
  const configuredBaseUrl =
    typeof psd.kiroModelsBaseUrl === "string"
      ? psd.kiroModelsBaseUrl
      : getProviderBaseUrl(ctx.connection.providerSpecificData);
  const endpoint = buildKiroModelsEndpoint(normalizeKiroBaseUrl(configuredBaseUrl));

  const response = await runWithProxyContext(ctx.proxy, () =>
    safeOutboundFetch(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-amz-json-1.0",
          Accept: "application/json",
          "x-amz-target": "AmazonCodeWhispererService.ListAvailableProfiles",
          "User-Agent": "AWS-SDK-JS/3.0.0 kiro-ide/1.0.0",
          "X-Amz-User-Agent": "aws-sdk-js/3.0.0 kiro-ide/1.0.0",
        },
        body: JSON.stringify({}),
      },
      { timeoutMs: 10_000 }
    )
  ).catch(() => null);

  if (!response) {
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: buildKiroFallbackModels(),
      source: "local_catalog",
      warning: "Kiro API unavailable — using local catalog",
    });
  }

  if (!response.ok) {
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: buildKiroFallbackModels(),
      source: "local_catalog",
      warning: `Kiro API unavailable (${response.status}) — using local catalog`,
    });
  }

  const payload = await response.json();
  const models = mapKiroModelsFromApi(payload, !ctx.excludeHidden);

  if (models.length === 0) {
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: buildKiroFallbackModels(),
      source: "local_catalog",
      warning: "Kiro API returned no models — using local catalog",
    });
  }

  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models,
    source: "api",
  });
}
