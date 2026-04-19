import { isV1WsBridgeEnabled } from "@/shared/utils/featureFlags";
import { validateWsHandshake } from "@/lib/ws/handshake";

export async function GET(request: Request) {
  if (!isV1WsBridgeEnabled()) {
    return Response.json(
      {
        error: {
          type: "not_found",
          message: "Not found",
        },
      },
      { status: 404 }
    );
  }

  const handshake = await validateWsHandshake(request);
  if (!handshake.ok) {
    return Response.json(
      {
        error: {
          type: "invalid_request",
          message: handshake.reason || "Invalid websocket handshake",
        },
      },
      { status: handshake.status }
    );
  }

  return Response.json(
    {
      ok: true,
      message: "WebSocket bridge handshake validated",
      protocol: handshake.acceptedProtocol,
      bridgeScript: "scripts/v1-ws-bridge.mjs",
      note: "Runtime upgrade handling must be enabled at the Node bridge layer.",
    },
    { status: 501 }
  );
}
