import { isAuthRequired } from "@/shared/utils/apiAuth";
import { createErrorResponse } from "@/lib/api/errorResponse";
import { getJwtSecret } from "@/shared/utils/jwtSecret";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

function getAuthTokenFromRequestCookieHeader(request: Request): string | null {
  const rawCookie = request.headers.get("cookie") || "";
  if (!rawCookie) return null;

  const match = rawCookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function isDashboardSessionAuthenticated(request: Request): Promise<boolean> {
  const secret = getJwtSecret();
  if (!secret) return false;

  const tokenFromRequest = getAuthTokenFromRequestCookieHeader(request);
  if (tokenFromRequest) {
    try {
      await jwtVerify(tokenFromRequest, secret);
      return true;
    } catch {
      // Continue to cookieStore fallback in case request header cookies are stale/rewritten.
    }
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return false;
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function requireManagementAuth(request: Request): Promise<Response | null> {
  if (!(await isAuthRequired())) {
    return null;
  }

  if (await isDashboardSessionAuthenticated(request)) {
    return null;
  }

  return createErrorResponse({
    status: 401,
    message: "Authentication required",
    type: "invalid_request",
  });
}
