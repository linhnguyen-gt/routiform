import { getStaticModelProvidersRegistry } from "./static-model-providers-registry";
import type { GetModelsHandlerContext } from "./get-models-handler-context";
import type { NextResponse } from "next/server";

export async function handleStaticRegistryModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  const registry = getStaticModelProvidersRegistry();
  const staticModelsFn =
    ctx.provider in registry ? registry[ctx.provider as keyof typeof registry] : undefined;
  if (!staticModelsFn) return null;

  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: staticModelsFn(),
  });
}
