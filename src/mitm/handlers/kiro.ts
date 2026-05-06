import type { IncomingMessage, ServerResponse } from "http";
import { fetchRouter, pipeSSE } from "./base.js";

export async function intercept(
  req: IncomingMessage,
  res: ServerResponse,
  bodyBuffer: Buffer,
  mappedModel: string
) {
  try {
    const body = JSON.parse(bodyBuffer.toString());
    body.model = mappedModel;
    const routerRes = await fetchRouter(
      body,
      "/v1/chat/completions",
      req.headers as Record<string, string | string[] | undefined>
    );
    await pipeSSE(routerRes, res, null);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[kiro] ${msg}`);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: msg, type: "mitm_error" } }));
  }
}
