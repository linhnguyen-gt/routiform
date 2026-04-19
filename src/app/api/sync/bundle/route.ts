import { createErrorResponse } from "@/lib/api/errorResponse";
import { buildSyncBundleResponse } from "@/lib/sync/bundle";
import { authenticateSyncToken } from "@/lib/sync/tokens";

export async function GET(request: Request) {
  const auth = await authenticateSyncToken(request);
  if (!auth.ok || !auth.tokenRecord) {
    return createErrorResponse({
      status: auth.status,
      message: auth.error || "Authentication failed",
      type: "invalid_request",
    });
  }

  const response = await buildSyncBundleResponse(request, auth.tokenRecord);
  if (response.status === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: response.etag,
        "Cache-Control": "private, no-cache",
      },
    });
  }

  return Response.json(
    {
      settings: response.payload.settings,
      providers: response.payload.providers,
      modelAliases: response.payload.modelAliases,
      combos: response.payload.combos,
      apiKeys: response.payload.apiKeys,
    },
    {
      status: 200,
      headers: {
        ETag: response.etag,
        "Cache-Control": "private, no-cache",
      },
    }
  );
}
