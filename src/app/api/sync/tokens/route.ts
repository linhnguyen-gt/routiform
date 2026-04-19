import { createErrorResponse, createErrorResponseFromUnknown } from "@/lib/api/errorResponse";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { issueSyncToken, listSyncTokenRecords } from "@/lib/sync/tokens";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { createSyncTokenSchema } from "@/shared/validation/schemas";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const items = await listSyncTokenRecords(request);
    return Response.json({ items, total: items.length });
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to list sync tokens");
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return createErrorResponse({
      status: 400,
      message: "Invalid JSON body",
      type: "invalid_request",
    });
  }

  const validation = validateBody(createSyncTokenSchema, rawBody);
  if (isValidationFailure(validation)) {
    return createErrorResponse({
      status: 400,
      message: validation.error.message,
      details: validation.error.details,
      type: "invalid_request",
    });
  }

  try {
    const created = await issueSyncToken(validation.data.name, request);
    return Response.json(
      {
        id: created.id,
        name: created.name,
        tokenPrefix: created.tokenPrefix,
        token: created.token,
        isActive: created.isActive,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        warning: "Store this token securely - it will not be shown again.",
      },
      { status: 201 }
    );
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to create sync token");
  }
}
