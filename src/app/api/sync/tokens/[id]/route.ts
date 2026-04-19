import { createErrorResponse, createErrorResponseFromUnknown } from "@/lib/api/errorResponse";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getSyncTokenRecord, revokeSyncTokenById } from "@/lib/sync/tokens";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const resolvedParams = await params;
  try {
    const record = await getSyncTokenRecord(resolvedParams.id, request);
    if (!record) {
      return createErrorResponse({
        status: 404,
        message: "Sync token not found",
        type: "not_found",
      });
    }

    return Response.json({ token: record });
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to load sync token");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const resolvedParams = await params;
  try {
    const revoked = await revokeSyncTokenById(resolvedParams.id, request);
    if (!revoked) {
      return createErrorResponse({
        status: 404,
        message: "Sync token not found or already revoked",
        type: "not_found",
      });
    }

    return Response.json({
      success: true,
      id: resolvedParams.id,
      revokedAt: new Date().toISOString(),
    });
  } catch (error) {
    return createErrorResponseFromUnknown(error, "Failed to revoke sync token");
  }
}
