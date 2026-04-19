import { isAuthenticated } from "@/shared/utils/apiAuth";

const DEFAULT_ALLOWED_PROTOCOLS = ["openai-realtime-v1"];

function parseAllowlist(raw: string | undefined): string[] {
  if (!raw || raw.trim().length === 0) {
    return [...DEFAULT_ALLOWED_PROTOCOLS];
  }

  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : [...DEFAULT_ALLOWED_PROTOCOLS];
}

function parseProtocols(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export type WsHandshakeResult = {
  ok: boolean;
  status: number;
  reason?: string;
  acceptedProtocol?: string;
};

export async function validateWsHandshake(
  request: Request,
  authCheck: (request: Request) => Promise<boolean> = isAuthenticated
): Promise<WsHandshakeResult> {
  const upgrade = request.headers.get("upgrade");
  const connection = request.headers.get("connection");
  const version = request.headers.get("sec-websocket-version");
  const wsKey = request.headers.get("sec-websocket-key");

  if (!upgrade || upgrade.toLowerCase() !== "websocket") {
    return { ok: false, status: 426, reason: "Expected websocket upgrade" };
  }

  if (!connection || !connection.toLowerCase().includes("upgrade")) {
    return { ok: false, status: 400, reason: "Missing connection upgrade token" };
  }

  if (version !== "13") {
    return { ok: false, status: 400, reason: "Unsupported websocket version" };
  }

  if (!wsKey || wsKey.length < 16) {
    return { ok: false, status: 400, reason: "Invalid websocket key" };
  }

  const authenticated = await authCheck(request);
  if (!authenticated) {
    return { ok: false, status: 401, reason: "Authentication required" };
  }

  const requestedProtocols = parseProtocols(request.headers.get("sec-websocket-protocol"));
  const allowedProtocols = parseAllowlist(process.env.V1_WS_PROTOCOL_ALLOWLIST);

  if (requestedProtocols.length === 0) {
    return {
      ok: false,
      status: 400,
      reason: `Missing required protocol. Allowed: ${allowedProtocols.join(", ")}`,
    };
  }

  const accepted = requestedProtocols.find((protocol) => allowedProtocols.includes(protocol));
  if (!accepted) {
    return {
      ok: false,
      status: 403,
      reason: `Protocol not allowed. Allowed: ${allowedProtocols.join(", ")}`,
    };
  }

  return { ok: true, status: 200, acceptedProtocol: accepted };
}
