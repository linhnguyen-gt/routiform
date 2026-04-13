import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { updateComboDefaultsSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

/**
 * GET /api/settings/combo-defaults
 * Returns the current combo global defaults and provider overrides
 */
export async function GET() {
  try {
    const settings: Record<string, unknown> = await getSettings();
    return NextResponse.json({
      comboDefaults: settings.comboDefaults || {
        strategy: "priority",
        maxRetries: 1,
        retryDelayMs: 2000,
        timeoutMs: 120000,
        healthCheckEnabled: true,
        healthCheckTimeoutMs: 3000,
        maxComboDepth: 3,
        trackMetrics: true,
      },
      providerOverrides: settings.providerOverrides || {},
    });
  } catch (error) {
    console.log("Error fetching combo defaults:", error);
    return NextResponse.json({ error: "Failed to fetch combo defaults" }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/combo-defaults
 * Update combo global defaults and/or provider overrides
 * Body: { comboDefaults?: {...}, providerOverrides?: {...} }
 */
export async function PATCH(request) {
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
    const validation = validateBody(updateComboDefaultsSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const body = validation.data;

    const updates: Record<string, unknown> = {};

    if (body.comboDefaults) {
      updates.comboDefaults = body.comboDefaults;
    }
    if (body.providerOverrides) {
      updates.providerOverrides = body.providerOverrides;
    }

    const settings: Record<string, unknown> = await updateSettings(updates);
    return NextResponse.json({
      comboDefaults: settings.comboDefaults || {},
      providerOverrides: settings.providerOverrides || {},
    });
  } catch (error) {
    console.log("Error updating combo defaults:", error);
    return NextResponse.json({ error: "Failed to update combo defaults" }, { status: 500 });
  }
}
