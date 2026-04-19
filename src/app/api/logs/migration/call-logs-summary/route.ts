import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { migrateCallLogsToSummaryStorageMode } from "@/lib/usage/callLogsMigration";

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Optional body only.
  }

  const dryRun = body.dryRun !== false;
  const limit = Number(body.limit || 5000);
  const result = migrateCallLogsToSummaryStorageMode({ dryRun, limit });

  return NextResponse.json({
    success: true,
    dryRun,
    ...result,
    doBeforeRelease: [
      "Run this endpoint in dryRun mode on a production-like DATA_DIR snapshot.",
      "Take full DATA_DIR backup before non-dry-run migration.",
      "Sample-verify detail API responses after migration using artifact fallback.",
      "Monitor call_logs table size and disk artifact availability post-migration.",
    ],
  });
}
