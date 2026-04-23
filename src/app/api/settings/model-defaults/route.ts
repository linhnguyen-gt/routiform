import { getSettings, updateSettings } from "@/lib/db/settings";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import {
  addModelReasoningDefaultSchema,
  removeModelReasoningDefaultSchema,
  updateModelReasoningDefaultsSchema,
} from "@/shared/validation/schemas";
import {
  getBuiltInModelReasoningEffortDefaults,
  setCustomModelReasoningEffortDefaults,
} from "@routiform/open-sse/config/registry-params.ts";
import { NextResponse } from "next/server";

async function readDbCustomDefaults(): Promise<Record<string, string>> {
  const settings = await getSettings();
  const raw = settings.modelReasoningDefaults;
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

async function writeDbCustomDefaults(defaults: Record<string, string>) {
  await updateSettings({ modelReasoningDefaults: defaults });
}

async function snapshot() {
  const dbCustom = await readDbCustomDefaults();
  const builtIn = getBuiltInModelReasoningEffortDefaults();
  return {
    builtIn,
    custom: dbCustom,
    effective: { ...builtIn, ...dbCustom },
  };
}

export async function GET() {
  try {
    return NextResponse.json(await snapshot());
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
    const dbDefaults = await readDbCustomDefaults();
    const merged = { ...dbDefaults, ...validation.data.defaults };
    await writeDbCustomDefaults(merged);
    setCustomModelReasoningEffortDefaults(merged);
    return NextResponse.json({ success: true, ...(await snapshot()) });
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
    const dbDefaults = await readDbCustomDefaults();
    const key = `${provider}/${model}`;
    dbDefaults[key] = effort;
    await writeDbCustomDefaults(dbDefaults);
    setCustomModelReasoningEffortDefaults(dbDefaults);
    return NextResponse.json({ success: true, ...(await snapshot()) });
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
    const dbDefaults = await readDbCustomDefaults();
    const key = `${provider}/${model}`;
    delete dbDefaults[key];
    await writeDbCustomDefaults(dbDefaults);
    setCustomModelReasoningEffortDefaults(dbDefaults);
    return NextResponse.json({ success: true, ...(await snapshot()) });
  } catch (error) {
    console.error("[API ERROR] /api/settings/model-defaults DELETE:", error);
    return NextResponse.json({ error: "Failed to remove model default" }, { status: 500 });
  }
}
