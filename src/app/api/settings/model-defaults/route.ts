import { NextResponse } from "next/server";
import { updateSettings } from "@/lib/db/settings";
import {
  getBuiltInModelReasoningEffortDefaults,
  getCustomModelReasoningEffortDefaults,
  getEffectiveModelReasoningEffortDefaults,
  removeModelReasoningEffortDefault,
  setCustomModelReasoningEffortDefaults,
  setModelReasoningEffortDefault,
} from "@routiform/open-sse/config/providerRegistry.ts";
import {
  addModelReasoningDefaultSchema,
  removeModelReasoningDefaultSchema,
  updateModelReasoningDefaultsSchema,
} from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

function snapshot() {
  return {
    builtIn: getBuiltInModelReasoningEffortDefaults(),
    custom: getCustomModelReasoningEffortDefaults(),
    effective: getEffectiveModelReasoningEffortDefaults(),
  };
}

async function persistCustomDefaults() {
  await updateSettings({ modelReasoningDefaults: getCustomModelReasoningEffortDefaults() });
}

export async function GET() {
  try {
    return NextResponse.json(snapshot());
  } catch (error) {
    console.error("[API ERROR] /api/settings/model-defaults GET:", error);
    return NextResponse.json({ error: "Failed to get model defaults" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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

  const validation = validateBody(updateModelReasoningDefaultsSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    setCustomModelReasoningEffortDefaults(validation.data.defaults);
    await persistCustomDefaults();
    return NextResponse.json({ success: true, ...snapshot() });
  } catch (error) {
    console.error("[API ERROR] /api/settings/model-defaults PUT:", error);
    return NextResponse.json({ error: "Failed to update model defaults" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

  const validation = validateBody(addModelReasoningDefaultSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const { provider, model, effort } = validation.data;
    const ok = setModelReasoningEffortDefault(provider, model, effort);
    if (!ok) {
      return NextResponse.json({ error: "Invalid provider/model/effort" }, { status: 400 });
    }
    await persistCustomDefaults();
    return NextResponse.json({ success: true, ...snapshot() });
  } catch (error) {
    console.error("[API ERROR] /api/settings/model-defaults POST:", error);
    return NextResponse.json({ error: "Failed to add model default" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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

  const validation = validateBody(removeModelReasoningDefaultSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const { provider, model } = validation.data;
    const removed = removeModelReasoningEffortDefault(provider, model);
    if (!removed) {
      return NextResponse.json({ error: "Default not found" }, { status: 404 });
    }
    await persistCustomDefaults();
    return NextResponse.json({ success: true, ...snapshot() });
  } catch (error) {
    console.error("[API ERROR] /api/settings/model-defaults DELETE:", error);
    return NextResponse.json({ error: "Failed to remove model default" }, { status: 500 });
  }
}
