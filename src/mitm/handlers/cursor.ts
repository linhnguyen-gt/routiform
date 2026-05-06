import type { IncomingMessage, ServerResponse } from "http";

/**
 * Cursor MITM handler — coming soon
 */
export async function intercept(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(501, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: {
        message: "Cursor MITM support is coming soon.",
        type: "not_implemented",
      },
    })
  );
}
