import { NextResponse } from "next/server";
import { getProviderNodeById } from "@/models";
import {
  isClaudeCodeCompatibleProvider,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
} from "@/shared/constants/providers";
import {
  getAuditActorFromRequest,
  getAuditIpFromRequest,
  logAuditEvent,
} from "@/lib/compliance/index";
import { validateProviderApiKey } from "@/lib/providers/validation";
import { validateProviderApiKeySchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

// POST /api/providers/validate - Validate API key with provider
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
    const validation = validateBody(validateProviderApiKeySchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { provider, apiKey, validationModelId, customUserAgent } = validation.data;

    let providerSpecificData: Record<string, unknown> = { validationModelId };
    if (customUserAgent) {
      providerSpecificData.customUserAgent = customUserAgent;
    }

    if (isOpenAICompatibleProvider(provider) || isAnthropicCompatibleProvider(provider)) {
      const node: Record<string, unknown> = await getProviderNodeById(provider);
      if (!node) {
        const typeName = isOpenAICompatibleProvider(provider)
          ? "OpenAI"
          : isClaudeCodeCompatibleProvider(provider)
            ? "CC"
            : "Anthropic";
        return NextResponse.json(
          { error: `${typeName} Compatible node not found` },
          { status: 404 }
        );
      }
      providerSpecificData = {
        ...providerSpecificData,
        baseUrl: node.baseUrl,
        apiType: node.apiType,
        chatPath: node.chatPath,
        modelsPath: node.modelsPath,
      };
    }

    const result = await validateProviderApiKey({
      provider,
      apiKey,
      providerSpecificData,
    });

    logAuditEvent({
      action: "provider.connection.validate",
      actor: await getAuditActorFromRequest(request),
      target: provider,
      details: {
        provider,
        valid: Boolean((result as Record<string, unknown>).valid),
        method: (result as Record<string, unknown>).method || null,
        unsupported: Boolean((result as Record<string, unknown>).unsupported),
      },
      ipAddress: getAuditIpFromRequest(request),
    });

    if ("unsupported" in result && result.unsupported) {
      return NextResponse.json({ error: "Provider validation not supported" }, { status: 400 });
    }

    return NextResponse.json({
      valid: !!result.valid,
      error: result.valid ? null : result.error || "Invalid API key",
      warning: ("warning" in result ? result.warning : null) || null,
      method: ("method" in result ? result.method : null) || null,
    });
  } catch (error) {
    console.log("Error validating API key:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
