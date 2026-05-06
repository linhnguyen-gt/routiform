import type { IncomingMessage, ServerResponse } from "http";
import { fetchRouter, pipeSSE } from "./base.js";

const URL_MAP: Record<string, string> = {
  "/chat/completions": "/v1/chat/completions",
  "/v1/messages": "/v1/messages",
  "/responses": "/v1/responses",
};

function resolveRouterPath(reqUrl: string): string {
  for (const [pattern, routerPath] of Object.entries(URL_MAP)) {
    if (reqUrl.includes(pattern)) return routerPath;
  }
  return "/v1/chat/completions";
}

export async function intercept(
  req: IncomingMessage,
  res: ServerResponse,
  bodyBuffer: Buffer,
  mappedModel: string
) {
  try {
    const body = JSON.parse(bodyBuffer.toString());
    body.model = mappedModel;
    const routerPath = resolveRouterPath(req.url || "");
    const routerRes = await fetchRouter(
      body,
      routerPath,
      req.headers as Record<string, string | string[] | undefined>
    );
    await pipeSSE(routerRes, res, null);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[copilot] ${msg}`);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: msg, type: "mitm_error" } }));
  }
}
