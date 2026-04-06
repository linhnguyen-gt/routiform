import { NextResponse } from "next/server";
import {
  setSystemPromptConfig,
  getSystemPromptConfig,
} from "@routiform/open-sse/services/systemPrompt.ts";
import { updateSettings } from "@/lib/localDb";
import { updateSystemPromptSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

export async function GET() {
  try {
    return NextResponse.json(getSystemPromptConfig());
  } catch (error) {
    console.error("Error reading system prompt config:", error);
    return NextResponse.json({ error: "Failed to read system prompt config" }, { status: 500 });
  }
}

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
    const validation = validateBody(updateSystemPromptSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const body = validation.data;

    setSystemPromptConfig(body);
    await updateSettings({ systemPrompt: body });

    return NextResponse.json(getSystemPromptConfig());
  } catch (error) {
    console.error("Error updating system prompt config:", error);
    return NextResponse.json({ error: "Failed to update system prompt config" }, { status: 500 });
  }
}
