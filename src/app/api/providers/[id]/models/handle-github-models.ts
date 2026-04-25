import { NextResponse } from "next/server";
import { OFFICIAL_GITHUB_COPILOT_MODELS } from "./github-copilot-official-models";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleGithubModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (ctx.provider !== "github") return null;

  // GitHub Copilot does not support API models list
  // Return static models from local catalog
  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: OFFICIAL_GITHUB_COPILOT_MODELS.map((m) => ({ ...m })),
    source: "local_catalog",
  });
}
