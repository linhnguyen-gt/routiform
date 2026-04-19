import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { migrateCallLogsToSummaryStorageMode } from "@/lib/usage/callLogsMigration";

const callLogsSummaryMigrationSchema = z.object({
  dryRun: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100000).optional(),
});

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let body: z.infer<typeof callLogsSummaryMigrationSchema> = {};

  const rawBody = await request.text();
  if (rawBody.trim().length > 0) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsedBody = callLogsSummaryMigrationSchema.safeParse(parsedJson);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid request body",
            details: parsedBody.error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    body = parsedBody.data;
  }

  const dryRun = body.dryRun ?? true;
  const limit = body.limit ?? 5000;
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
