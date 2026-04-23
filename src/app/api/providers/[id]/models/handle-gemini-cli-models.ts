import { NextResponse } from "next/server";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { asRecord } from "./json-utils";
import { toModelsRouteError } from "./models-route-error";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleGeminiCliModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (ctx.provider !== "gemini-cli") return null;

  if (!ctx.accessToken) {
    return NextResponse.json(
      { error: "No access token for Gemini CLI. Please reconnect OAuth." },
      { status: 400 }
    );
  }

  const psd = asRecord(ctx.connection.providerSpecificData);
  const projectId = ctx.connection.projectId || psd.projectId || null;

  if (!projectId) {
    return NextResponse.json(
      { error: "Gemini CLI project ID not available. Please reconnect OAuth." },
      { status: 400 }
    );
  }

  try {
    const quotaRes = await runWithProxyContext(ctx.proxy, () =>
      safeOutboundFetch(
        "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ project: projectId }),
        },
        { timeoutMs: 10_000 }
      )
    );

    if (!quotaRes.ok) {
      const errText = await quotaRes.text();
      console.log(`[models] Gemini CLI quota fetch failed (${quotaRes.status}):`, errText);
      return NextResponse.json(
        { error: `Failed to fetch Gemini CLI models: ${quotaRes.status}` },
        { status: quotaRes.status }
      );
    }

    const quotaData = await quotaRes.json();
    const buckets: Array<{ modelId?: string; tokenType?: string }> = quotaData.buckets || [];

    const models = buckets
      .filter((b) => b.modelId)
      .map((b) => ({
        id: b.modelId,
        name: b.modelId,
        owned_by: "google",
      }));

    return ctx.buildResponse({ provider: ctx.provider, connectionId: ctx.connectionId, models });
  } catch (err: unknown) {
    const mapped = toModelsRouteError(err);
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[models] Gemini CLI model fetch error:", msg);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
