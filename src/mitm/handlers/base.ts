import type { ServerResponse } from "http";
import { createResponseDumper } from "../logger.js";

const DEFAULT_LOCAL_ROUTER = "http://localhost:20128";
const ROUTER_BASE =
  String(process.env.MITM_ROUTER_BASE || DEFAULT_LOCAL_ROUTER)
    .trim()
    .replace(/\/+$/, "") || DEFAULT_LOCAL_ROUTER;
const API_KEY = process.env.ROUTER_API_KEY;

const STRIP_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "content-type",
  "authorization",
]);

export async function fetchRouter(
  openaiBody: Record<string, unknown>,
  path = "/v1/chat/completions",
  clientHeaders: Record<string, string | string[] | undefined> = {}
): Promise<Response> {
  const forwarded: Record<string, string> = {};
  for (const [k, v] of Object.entries(clientHeaders)) {
    if (!STRIP_HEADERS.has(k.toLowerCase()) && typeof v === "string") forwarded[k] = v;
  }

  const response = await fetch(`${ROUTER_BASE}${path}`, {
    method: "POST",
    headers: {
      ...forwarded,
      "Content-Type": "application/json",
      ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
    },
    body: JSON.stringify(openaiBody),
  });

  return response;
}

export async function pipeSSE(
  routerRes: Response,
  res: ServerResponse,
  dumper: ReturnType<typeof createResponseDumper>
) {
  const ct = routerRes.headers.get("content-type") || "application/json";
  const status = routerRes.status || 200;
  const resHeaders: Record<string, string> = {
    "Content-Type": ct,
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
  if (ct.includes("text/event-stream")) resHeaders["X-Accel-Buffering"] = "no";
  res.writeHead(status, resHeaders);
  if (dumper) dumper.writeHeader(routerRes.status, Object.fromEntries(routerRes.headers));

  if (!routerRes.body) {
    const text = await routerRes.text().catch(() => "");
    if (dumper) {
      dumper.writeChunk(text);
      dumper.end();
    }
    res.end(text);
    return;
  }

  const reader = routerRes.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (dumper) dumper.end();
      res.end();
      break;
    }
    if (dumper) dumper.writeChunk(Buffer.from(value));
    res.write(decoder.decode(value, { stream: true }));
  }
}
