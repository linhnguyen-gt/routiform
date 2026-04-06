import { NextResponse } from "next/server";
import {
  getBackgroundDegradationConfig,
  setBackgroundDegradationConfig,
  resetStats,
} from "@routiform/open-sse/services/backgroundTaskDetector.ts";
import { updateSettings } from "@/lib/db/settings";
import { jsonObjectSchema, resetStatsActionSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

/**
 * GET /api/settings/background-degradation
 * Returns the current background degradation configuration.
 */
export async function GET() {
  try {
    return NextResponse.json(getBackgroundDegradationConfig());
  } catch (error) {
    console.error("[API ERROR] /api/settings/background-degradation GET:", error);
    return NextResponse.json({ error: "Failed to get config" }, { status: 500 });
  }
}

/**
 * PUT /api/settings/background-degradation
 * Update the background degradation configuration.
 * Body: { enabled?: boolean, degradationMap?: {...}, detectionPatterns?: [...] }
 */
export async function PUT(request) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(jsonObjectSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const config = validation.data;

    setBackgroundDegradationConfig(config);

    // Persist to database (excluding stats)
    const { stats, ...persistable } = getBackgroundDegradationConfig();
    await updateSettings({ backgroundDegradation: JSON.stringify(persistable) });

    return NextResponse.json({ success: true, ...getBackgroundDegradationConfig() });
  } catch (error) {
    console.error("[API ERROR] /api/settings/background-degradation PUT:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}

/**
 * POST /api/settings/background-degradation
 * Reset stats counters.
 * Body: { action: "reset-stats" }
 */
export async function POST(request) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(resetStatsActionSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { action } = validation.data;

    if (action === "reset-stats") {
      resetStats();
      return NextResponse.json({ success: true, stats: getBackgroundDegradationConfig().stats });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[API ERROR] /api/settings/background-degradation POST:", error);
    return NextResponse.json({ error: "Failed to execute action" }, { status: 500 });
  }
}
