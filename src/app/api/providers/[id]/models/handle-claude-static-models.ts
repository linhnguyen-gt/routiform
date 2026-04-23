import { getStaticModelProvidersRegistry } from "./static-model-providers-registry";
import type { GetModelsHandlerContext } from "./get-models-handler-context";
import type { NextResponse } from "next/server";

export async function handleClaudeStaticModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (ctx.provider !== "claude") return null;

  const registry = getStaticModelProvidersRegistry();
  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: registry.claude(),
  });
}
