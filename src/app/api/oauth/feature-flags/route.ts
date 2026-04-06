import { NextResponse } from "next/server";
import { QODER_CONFIG } from "@/lib/oauth/constants/oauth";

export const dynamic = "force-dynamic";

/**
 * Public flags for OAuth UI (no secrets). Used by the dashboard to hide browser OAuth
 * for providers that require server-side env (e.g. Qoder).
 */
export async function GET() {
  return NextResponse.json({
    qoderBrowserOAuthEnabled: QODER_CONFIG.enabled,
  });
}
