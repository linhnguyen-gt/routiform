import { NextRequest, NextResponse } from "next/server";
import { getDbInstance } from "@/lib/db/core";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = getDbInstance();
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (range) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get provider distribution
    const providers = db
      .prepare(
        `SELECT
           provider,
           COUNT(*) as count
         FROM call_logs
         WHERE timestamp >= ? AND provider IS NOT NULL
         GROUP BY provider
         ORDER BY count DESC`
      )
      .all(startDate.toISOString()) as Array<{ provider: string; count: number }>;

    const total = providers.reduce((sum, p) => sum + p.count, 0);

    const providersWithPercentage = providers.map((p) => ({
      provider: p.provider,
      count: p.count,
      percentage: total > 0 ? (p.count / total) * 100 : 0,
    }));

    return NextResponse.json({
      providers: providersWithPercentage,
      total,
    });
  } catch (error) {
    console.error("Error fetching provider share:", error);
    return NextResponse.json({ error: "Failed to fetch provider share" }, { status: 500 });
  }
}
