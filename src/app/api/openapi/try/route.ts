/**
 * API: OpenAPI "Try It" Proxy
 * POST — forwards a request to a local endpoint and returns the result
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, isValidationFailure } from "@/shared/validation/helpers";

const tryRequestSchema = z.object({
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
    .optional()
    .default("GET"),
  path: z.string().min(1, "Path is required").startsWith("/", "Path must start with /"),
  headers: z.record(z.string(), z.string()).optional().default({}),
  body: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validation = validateBody(tryRequestSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { method, path, headers, body: reqBody } = validation.data;

    // Build the target URL using the incoming request's origin
    const origin = request.headers.get("x-forwarded-proto")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
      : `http://${request.headers.get("host") || "localhost:20128"}`;

    const targetUrl = `${origin}${path}`;

    const start = performance.now();

    // Forward cookies/auth from the original request
    const forwardHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };

    // Forward auth from the dashboard session
    const cookie = request.headers.get("cookie");
    if (cookie && !forwardHeaders["Cookie"]) {
      forwardHeaders["Cookie"] = cookie;
    }

    if (reqBody && !forwardHeaders["Content-Type"]) {
      forwardHeaders["Content-Type"] = "application/json";
    }

    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: forwardHeaders,
    };

    if (reqBody && method.toUpperCase() !== "GET") {
      fetchOptions.body = typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
    }

    const res = await fetch(targetUrl, fetchOptions);
    const latencyMs = Math.round(performance.now() - start);

    // Read response
    const contentType = res.headers.get("content-type") || "";
    let responseBody: unknown;

    if (contentType.includes("application/json")) {
      responseBody = await res.json();
    } else {
      const text = await res.text();
      // Truncate very large responses
      responseBody = text.length > 10000 ? text.slice(0, 10000) + "\n... (truncated)" : text;
    }

    // Collect response headers
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: responseBody,
      latencyMs,
      contentType,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: { error: error instanceof Error ? error.message : String(error) || "Request failed" },
        latencyMs: 0,
        contentType: "application/json",
      },
      { status: 200 } // Return 200 so the frontend can display the error
    );
  }
}
