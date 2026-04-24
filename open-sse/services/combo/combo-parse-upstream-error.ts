/** Extract error message and optional retryAfter from a non-OK upstream Response body. */
export async function readUpstreamErrorFromResponse(result: Response): Promise<{
  errorText: string;
  retryAfter: unknown;
}> {
  let errorText = result.statusText || "";
  let retryAfter: unknown = null;
  try {
    const cloned = result.clone();
    try {
      const text = await cloned.text();
      if (text) {
        errorText = text.substring(0, 500);
        const errorBody = JSON.parse(text) as {
          error?: { message?: string } | string;
          message?: string;
          retryAfter?: unknown;
        };
        const ebErr = errorBody?.error;
        const fromErr =
          typeof ebErr === "object" && ebErr && typeof ebErr.message === "string"
            ? ebErr.message
            : typeof ebErr === "string"
              ? ebErr
              : undefined;
        errorText = fromErr || errorBody?.message || errorText;
        retryAfter = errorBody?.retryAfter || null;
      }
    } catch {
      /* Clone parse failed */
    }
  } catch {
    /* Clone failed */
  }

  if (typeof errorText !== "string") {
    try {
      errorText = JSON.stringify(errorText);
    } catch {
      errorText = String(errorText);
    }
  }

  return { errorText, retryAfter };
}
