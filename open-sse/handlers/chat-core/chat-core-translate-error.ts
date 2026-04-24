import { HTTP_STATUS } from "../../config/constants.ts";
import { getCorsOrigin } from "../../utils/cors.ts";
import { createErrorResult } from "../../utils/error.ts";
import type { HandlerLogger } from "../types/chat-core.ts";

export function failureFromTranslateError(
  error: unknown,
  log: HandlerLogger | null | undefined
): Awaited<ReturnType<typeof createErrorResult>> & { success: false } {
  const err = error as { statusCode?: unknown; message?: string; errorType?: string };
  const parsedStatus = Number(err?.statusCode);
  const statusCode =
    Number.isInteger(parsedStatus) && parsedStatus >= 400 && parsedStatus <= 599
      ? parsedStatus
      : HTTP_STATUS.SERVER_ERROR;
  const message = err?.message || "Invalid request";
  const errorType = typeof err?.errorType === "string" ? err.errorType : null;

  log?.warn?.("TRANSLATE", `Request translation failed: ${message}`);

  if (errorType) {
    return {
      success: false,
      status: statusCode,
      error: message,
      response: new Response(
        JSON.stringify({
          error: {
            message,
            type: errorType,
            code: errorType,
          },
        }),
        {
          status: statusCode,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getCorsOrigin(),
          },
        }
      ),
    };
  }

  return createErrorResult(statusCode, message) as Awaited<ReturnType<typeof createErrorResult>> & {
    success: false;
  };
}
