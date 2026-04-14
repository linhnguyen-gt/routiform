import { NextRequest, NextResponse } from "next/server";
import { getDbInstance } from "@/lib/db/core";
import { runDbHealthCheck } from "@/lib/db/healthCheck";
import { backupDbFile } from "@/lib/db/backup";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const autoRepair = searchParams.get("autoRepair") === "true";
    const db = getDbInstance();

    const result = runDbHealthCheck(db, {
      autoRepair,
      createBackupBeforeRepair: () => {
        try {
          backupDbFile("health-check");
          return true;
        } catch (error) {
          console.error("[DB Health] Backup creation failed:", error);
          return false;
        }
      },
      expectedSchemaVersion: "1",
    });

    return NextResponse.json(result, {
      status: result.isHealthy ? 200 : 207,
    });
  } catch (error) {
    console.error("[DB Health] Health check failed:", error);
    return NextResponse.json(
      {
        error: "Health check failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
