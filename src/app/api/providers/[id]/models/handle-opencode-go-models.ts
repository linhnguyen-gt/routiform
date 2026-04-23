import { NextResponse } from "next/server";
import { getOpencodeGoModels } from "@/lib/providers/opencodeGoModelsCatalog";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleOpencodeGoModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (ctx.provider !== "opencode-go") return null;

  try {
    const models = await getOpencodeGoModels();
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models,
      source: "models.dev",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch opencode-go models: ${message}` },
      { status: 500 }
    );
  }
}
