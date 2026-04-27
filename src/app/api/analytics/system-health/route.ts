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

    // Diversity Score: number of unique providers used
    const diversityResult = db
      .prepare(
        `SELECT COUNT(DISTINCT provider) as unique_providers
         FROM call_logs
         WHERE timestamp >= ? AND provider IS NOT NULL`
      )
      .get(startDate.toISOString()) as { unique_providers: number };

    // Top combos with health metrics
    const combos = db
      .prepare(
        `SELECT
           combo_name,
           COUNT(*) as total_requests,
           SUM(CASE WHEN status >= 200 AND status < 300 THEN 1 ELSE 0 END) as successful_requests,
           AVG(duration) as avg_latency
         FROM call_logs
         WHERE timestamp >= ? AND combo_name IS NOT NULL
         GROUP BY combo_name
         ORDER BY total_requests DESC
         LIMIT 5`
      )
      .all(startDate.toISOString()) as Array<{
      combo_name: string;
      total_requests: number;
      successful_requests: number;
      avg_latency: number | null;
    }>;

    const combosWithHealth = combos.map((combo) => ({
      name: combo.combo_name,
      requests: combo.total_requests,
      successRate:
        combo.total_requests > 0 ? (combo.successful_requests / combo.total_requests) * 100 : 0,
      avgLatency: Math.round(combo.avg_latency || 0),
      health:
        combo.total_requests > 0 && combo.successful_requests / combo.total_requests >= 0.95
          ? "healthy"
          : "degraded",
    }));

    return NextResponse.json({
      diversityScore: diversityResult.unique_providers,
      topCombos: combosWithHealth,
    });
  } catch (error) {
    console.error("Error fetching system health:", error);
    return NextResponse.json({ error: "Failed to fetch system health" }, { status: 500 });
  }
}
