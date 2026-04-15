/**
 * Prompt Injection Guard — Express/Next.js middleware
 *
 * Wraps the inputSanitizer module as middleware for API routes.
 * Blocks or warns on detected prompt injection attempts.
 *
 * @module middleware/promptInjectionGuard
 */

import { sanitizeRequest } from "../shared/utils/inputSanitizer";

/**
 * @typedef {Object} GuardOptions
 * @property {"block"|"warn"|"log"} [mode="warn"] - Action on detection
 * @property {Object} [logger] - Logger instance (defaults to console)
 */

/**
 * Create a prompt injection guard middleware.
 *
 * @param {GuardOptions} [options={}]
 * @returns {(req: Request) => { blocked: boolean, result: Object }|null}
 */
export function createInjectionGuard(options: Record<string, unknown> = {}) {
  const mode = options.mode || process.env.INJECTION_GUARD_MODE || "warn";
  const logger = options.logger || console;

  /**
   * Check a request body for prompt injection.
   *
   * @param {Object} body - The parsed request body
   * @returns {{ blocked: boolean, result: Object }}
   */
  return function guardRequest(body: Record<string, unknown>) {
    if (!body || typeof body !== "object") {
      return { blocked: false, result: { flagged: false, detections: [], piiDetections: [] } };
    }

    const result = sanitizeRequest(body, logger as Console);

    // Check if any detections were found (sanitizeRequest returns .detections, NOT .flagged)
    const resultObj = result as {
      detections: Array<{ pattern: string; severity: string }>;
      piiDetections: unknown[];
    };
    if (resultObj.detections.length === 0 && resultObj.piiDetections.length === 0) {
      return { blocked: false, result };
    }

    const highSeverity = resultObj.detections.filter((d) => d.severity === "high");

    if (mode === "block" && highSeverity.length > 0) {
      (logger as Console).warn("[InjectionGuard] Blocked request with high-severity injection:", {
        detections: resultObj.detections.map((d) => ({ pattern: d.pattern, severity: d.severity })),
      });
      return { blocked: true, result };
    }

    if (mode === "warn" || mode === "log") {
      logger[mode === "warn" ? "warn" : "info"](
        "[InjectionGuard] Detected potential injection patterns:",
        {
          detections: resultObj.detections.map((d) => ({
            pattern: d.pattern,
            severity: d.severity,
          })),
          pii: resultObj.piiDetections.length,
        }
      );
    }

    return { blocked: false, result };
  };
}

/**
 * Next.js API route handler wrapper for injection guarding.
 *
 * @param {Function} handler - Original route handler
 * @param {GuardOptions} [options={}]
 * @returns {Function} Wrapped handler
 */
export function withInjectionGuard(
  handler: (request: Request, context: unknown) => Promise<Response>,
  options: Record<string, unknown> = {}
) {
  const guard = createInjectionGuard(options);

  return async function guardedHandler(request: Request, context: unknown) {
    // Only apply to POST/PUT/PATCH
    if (!["POST", "PUT", "PATCH"].includes(request.method)) {
      return handler(request, context);
    }

    try {
      // Clone request so body can still be read by handler
      const cloned = request.clone();
      const body = await cloned.json().catch(() => null);

      if (body) {
        const { blocked, result }: { blocked: boolean; result: unknown } = guard(body);

        if (blocked) {
          const resultObj = result as { detections: unknown[] };
          return new Response(
            JSON.stringify({
              error: {
                message: "Request blocked: potential prompt injection detected",
                type: "injection_detected",
                detections: resultObj.detections.length,
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Attach sanitization result as header for downstream handlers
        const resultObj = result as { flagged?: boolean; detections: unknown[] };
        if (resultObj.flagged) {
          request.headers.set("X-Injection-Flagged", "true");
          request.headers.set("X-Injection-Detections", String(resultObj.detections.length));
        }
      }
    } catch {
      // Don't block on guard errors — fail open
    }

    return handler(request, context);
  };
}
