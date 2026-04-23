import { NextResponse } from "next/server";
import { getProviderConnectionById } from "@/models";
import { getModelIsHidden, resolveProxyForProvider } from "@/lib/localDb";
import { asRecord } from "./json-utils";
import type { JsonRecord } from "./json-types";

export type GetModelsHandlerContext = {
  request: Request;
  excludeHidden: boolean;
  connection: JsonRecord;
  provider: string;
  connectionId: string;
  apiKey: string;
  accessToken: string;
  proxy: Awaited<ReturnType<typeof resolveProxyForProvider>>;
  buildResponse: (payload: Record<string, unknown>, statusConfig?: ResponseInit) => NextResponse;
};

export type ResolveGetModelsContextResult =
  | { kind: "response"; response: NextResponse }
  | { kind: "context"; context: GetModelsHandlerContext };

export async function resolveGetModelsContext(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
): Promise<ResolveGetModelsContextResult> {
  const params = await context.params;
  const { id } = params;

  const { searchParams } = new URL(request.url);
  const excludeHidden = searchParams.get("excludeHidden") === "true";

  const connection = await getProviderConnectionById(id);

  if (!connection) {
    return {
      kind: "response",
      response: NextResponse.json({ error: "Connection not found" }, { status: 404 }),
    };
  }

  const provider =
    typeof connection.provider === "string" && connection.provider.trim().length > 0
      ? connection.provider
      : null;
  if (!provider) {
    return {
      kind: "response",
      response: NextResponse.json({ error: "Invalid connection provider" }, { status: 400 }),
    };
  }

  const proxy = await resolveProxyForProvider(provider);

  const buildResponse = (payload: Record<string, unknown>, statusConfig?: ResponseInit) => {
    if (excludeHidden && payload.models && Array.isArray(payload.models)) {
      payload.models = payload.models.filter((m: unknown) => {
        const model = asRecord(m);
        const modelId = typeof model.id === "string" ? model.id : "";
        return !getModelIsHidden(provider, modelId);
      });
    }
    return NextResponse.json(payload, statusConfig);
  };

  const connectionRow = connection as JsonRecord;
  const connectionId = typeof connectionRow.id === "string" ? connectionRow.id : id;
  const apiKey = typeof connectionRow.apiKey === "string" ? connectionRow.apiKey : "";
  const accessToken =
    typeof connectionRow.accessToken === "string" ? connectionRow.accessToken : "";

  return {
    kind: "context",
    context: {
      request,
      excludeHidden,
      connection: connectionRow,
      provider,
      connectionId,
      apiKey,
      accessToken,
      proxy,
      buildResponse,
    },
  };
}
