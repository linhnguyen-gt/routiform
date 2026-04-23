import { NextResponse } from "next/server";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { buildClineCategorySets, normalizeModelKey } from "./cline-category-sets";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleClineModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (ctx.provider !== "cline") return null;

  const token = ctx.accessToken || ctx.apiKey;
  if (!token) {
    return NextResponse.json(
      { error: "No access token for Cline. Please reconnect OAuth." },
      { status: 400 }
    );
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const catalogRes = await runWithProxyContext(ctx.proxy, () =>
    safeOutboundFetch(
      "https://api.cline.bot/api/v1/ai/cline/models",
      {
        method: "GET",
        headers,
      },
      { timeoutMs: 15_000 }
    )
  );

  if (!catalogRes.ok) {
    return NextResponse.json(
      { error: `Failed to fetch models: ${catalogRes.status}` },
      { status: catalogRes.status }
    );
  }

  const catalogData = await catalogRes.json();
  const rawModels = Array.isArray(catalogData?.data)
    ? catalogData.data
    : Array.isArray(catalogData?.models)
      ? catalogData.models
      : [];

  let recommendedSet = new Set<string>();
  let freeSet = new Set<string>();
  try {
    const categoriesRes = await runWithProxyContext(ctx.proxy, () =>
      safeOutboundFetch(
        "https://api.cline.bot/api/v1/ai/cline/recommended-models",
        {
          method: "GET",
          headers,
        },
        { timeoutMs: 10_000 }
      )
    );
    if (categoriesRes.ok) {
      const categoriesData = await categoriesRes.json();
      const sets = buildClineCategorySets(categoriesData);
      recommendedSet = sets.recommended;
      freeSet = sets.free;
    }
  } catch {
    // Optional metadata endpoint failed; keep base model list.
  }

  const models = rawModels
    .map((model: Record<string, unknown>) => {
      const id = String(model.id || model.name || model.model || "").trim();
      const key = normalizeModelKey(id);
      const isRecommended = recommendedSet.has(key);
      const isFree = freeSet.has(key);
      return {
        ...model,
        id,
        name: model.name || model.display_name || model.displayName || id,
        ...(isRecommended || isFree
          ? {
              clineMeta: {
                recommended: isRecommended,
                free: isFree,
                categories: [
                  ...(isRecommended ? ["recommended"] : []),
                  ...(isFree ? ["free"] : []),
                ],
              },
            }
          : {}),
      };
    })
    .filter(
      (model: Record<string, unknown>) => typeof model.id === "string" && model.id.length > 0
    );

  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models,
  });
}
