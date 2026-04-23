import { PROVIDER_MODELS } from "@/shared/constants/models";
import { asRecord } from "./json-utils";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleQwenOauthModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (ctx.provider !== "qwen" || ctx.connection.authType !== "oauth") return null;

  const qwenModels = PROVIDER_MODELS["qwen"] || [];
  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models: qwenModels.map((m: unknown) => {
      const model = asRecord(m);
      return {
        id: model.id,
        name: model.name || model.id,
        owned_by: "qwen",
      };
    }),
    source: "local_catalog",
  });
}
