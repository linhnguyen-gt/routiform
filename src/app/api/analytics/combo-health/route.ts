import { NextRequest, NextResponse } from "next/server";
import { getDbInstance } from "@/lib/db/core";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    const rangeMap: Record<string, number> = {
      "1h": 1,
      "24h": 24,
      "7d": 7 * 24,
      "30d": 30 * 24,
    };

    const hours = rangeMap[range] || 24 * 30;
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const db = getDbInstance();

    // Get combo health metrics
    const comboData = db
      .prepare(
        `SELECT
           combo_name,
           COUNT(*) as total_requests,
           SUM(CASE WHEN status >= 200 AND status < 300 THEN 1 ELSE 0 END) as successful_requests,
           AVG(duration) as avg_latency,
           SUM(tokens_in + tokens_out) as total_tokens
         FROM call_logs
         WHERE timestamp >= ? AND combo_name IS NOT NULL
         GROUP BY combo_name
         ORDER BY total_requests DESC`
      )
      .all(startDate.toISOString()) as Array<{
      combo_name: string;
      total_requests: number;
      successful_requests: number;
      avg_latency: number;
      total_tokens: number;
    }>;

    const totalRequests = comboData.reduce((sum, c) => sum + c.total_requests, 0);
    const totalSuccessful = comboData.reduce((sum, c) => sum + c.successful_requests, 0);
    const avgLatency =
      comboData.reduce((sum, c) => sum + c.avg_latency * c.total_requests, 0) / totalRequests;

    const quotaHealth = {
      providers: comboData.map((combo) => {
        const successRate =
          combo.total_requests > 0 ? combo.successful_requests / combo.total_requests : 0;

        return {
          provider: combo.combo_name,
          name: combo.combo_name,
          share: combo.total_requests / totalRequests,
          trend: (successRate >= 0.95
            ? "stable"
            : successRate >= 0.8
              ? "declining"
              : "declining") as "improving" | "stable" | "declining",
        };
      }),
    };

    const performanceMetrics = {
      providers: comboData.map((combo) => ({
        name: combo.combo_name,
        latency: Math.round(combo.avg_latency),
        trend: "stable" as const,
      })),
    };

    return NextResponse.json({
      quotaHealth,
      performanceMetrics,
      performance: {
        avgLatencyMs: Math.round(avgLatency),
        successRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0,
        totalRequests,
      },
    });
  } catch (error) {
    console.error("Error fetching combo health:", error);
    return NextResponse.json({ error: "Failed to fetch combo health" }, { status: 500 });
  }
}
