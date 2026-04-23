import { NextResponse } from "next/server";
import {
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
} from "@/shared/constants/providers";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { getProviderBaseUrl } from "./json-utils";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleAnthropicCompatibleModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (!isAnthropicCompatibleProvider(ctx.provider)) return null;

  if (isClaudeCodeCompatibleProvider(ctx.provider)) {
    return NextResponse.json(
      { error: `Provider ${ctx.provider} does not support models listing` },
      { status: 400 }
    );
  }

  let baseUrl = getProviderBaseUrl(ctx.connection.providerSpecificData);
  if (!baseUrl) {
    return NextResponse.json(
      { error: "No base URL configured for Anthropic compatible provider" },
      { status: 400 }
    );
  }

  baseUrl = baseUrl.replace(/\/$/, "");
  if (baseUrl.endsWith("/messages")) {
    baseUrl = baseUrl.slice(0, -9);
  }

  const url = `${baseUrl}/models`;
  const token = ctx.accessToken || ctx.apiKey;
  const response = await runWithProxyContext(ctx.proxy, () =>
    safeOutboundFetch(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
          "anthropic-version": "2023-06-01",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      { timeoutMs: 15_000 }
    )
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`Error fetching models from ${ctx.provider}:`, errorText);
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  const models = data.data || data.models || [];

  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models,
  });
}
