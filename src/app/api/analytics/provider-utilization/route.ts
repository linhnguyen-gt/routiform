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
    const timeBucketExpr =
      range === "1h"
        ? "strftime('%Y-%m-%d %H:%M:00', timestamp)"
        : range === "24h"
          ? "strftime('%Y-%m-%d %H:00:00', timestamp)"
          : range === "7d"
            ? "strftime('%Y-%m-%d %H:00:00', timestamp)"
            : "strftime('%Y-%m-%d %H:00:00', timestamp)";

    // Get provider utilization over time
    const utilizationData = db
      .prepare(
        `SELECT
           provider,
           ${timeBucketExpr} as time_bucket,
           COUNT(*) as request_count,
           AVG(duration) as avg_latency,
           SUM(CASE WHEN status >= 200 AND status < 300 THEN 1 ELSE 0 END) as success_count
         FROM call_logs
         WHERE timestamp >= ? AND provider IS NOT NULL
         GROUP BY provider, time_bucket
         ORDER BY time_bucket ASC`
      )
      .all(startDate.toISOString()) as Array<{
      provider: string;
      time_bucket: string;
      request_count: number;
      avg_latency: number;
      success_count: number;
    }>;

    // Get unique providers and time buckets
    const providers = [...new Set(utilizationData.map((d) => d.provider))];
    const timeBuckets = [...new Set(utilizationData.map((d) => d.time_bucket))];

    // Calculate total requests per time bucket
    const totalsByTime = new Map<string, number>();
    utilizationData.forEach((row) => {
      const current = totalsByTime.get(row.time_bucket) || 0;
      totalsByTime.set(row.time_bucket, current + row.request_count);
    });

    // Transform data for chart - group by timestamp with provider shares
    const chartData = timeBuckets.map((timestamp) => {
      const dataPoint: Record<string, string | number> = { timestamp };

      providers.forEach((provider) => {
        const providerData = utilizationData.find(
          (d) => d.time_bucket === timestamp && d.provider === provider
        );
        const total = totalsByTime.get(timestamp) || 1;
        dataPoint[provider] = providerData ? (providerData.request_count / total) * 100 : 0;
      });

      return dataPoint;
    });

    return NextResponse.json({
      timeRange: range,
      providers,
      data: chartData,
    });
  } catch (error) {
    console.error("Error fetching provider utilization:", error);
    return NextResponse.json({ error: "Failed to fetch provider utilization" }, { status: 500 });
  }
}
