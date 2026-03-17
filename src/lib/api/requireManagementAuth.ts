import { isAuthenticated, isAuthRequired } from "@/shared/utils/apiAuth";
import { createErrorResponse } from "@/lib/api/errorResponse";

export async function requireManagementAuth(request: Request): Promise<Response | null> {
  if (!(await isAuthRequired())) {
    return null;
  }

  if (await isAuthenticated(request)) {
    return null;
  }

  return createErrorResponse({
    status: 401,
    message: "Authentication required",
    type: "invalid_request",
  });
}
