import { NextResponse } from "next/server";
import { getGlmModelsUrl } from "@routiform/open-sse/config/glmProvider.ts";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleGlmModels(ctx: GetModelsHandlerContext): Promise<NextResponse | null> {
  if (ctx.provider !== "glm" && ctx.provider !== "glmt") return null;

  const url = getGlmModelsUrl(ctx.connection.providerSpecificData);
  const token = ctx.apiKey || ctx.accessToken;

  const response = await runWithProxyContext(ctx.proxy, () =>
    safeOutboundFetch(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      { timeoutMs: 10_000 }
    )
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: `Failed to fetch models: ${response.status}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  const models = data.data || data.models || [];

  return ctx.buildResponse({ provider: ctx.provider, connectionId: ctx.connectionId, models });
}
