import { NextResponse } from "next/server";
import { getDbInstance } from "@/lib/db/core";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDbInstance();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // Total requests (last 30 days)
    const totalResult = db
      .prepare("SELECT COUNT(*) as count FROM call_logs WHERE timestamp >= ?")
      .get(thirtyDaysAgo) as { count: number };

    const prevTotalResult = db
      .prepare("SELECT COUNT(*) as count FROM call_logs WHERE timestamp >= ? AND timestamp < ?")
      .get(sixtyDaysAgo, thirtyDaysAgo) as { count: number };

    const totalTrend =
      prevTotalResult.count > 0
        ? ((totalResult.count - prevTotalResult.count) / prevTotalResult.count) * 100
        : 0;

    // Today's requests
    const todayResult = db
      .prepare("SELECT COUNT(*) as count FROM call_logs WHERE timestamp >= ?")
      .get(today) as { count: number };

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStart = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate()
    ).toISOString();

    const yesterdayResult = db
      .prepare("SELECT COUNT(*) as count FROM call_logs WHERE timestamp >= ? AND timestamp < ?")
      .get(yesterdayStart, today) as { count: number };

    const todayTrend =
      yesterdayResult.count > 0
        ? ((todayResult.count - yesterdayResult.count) / yesterdayResult.count) * 100
        : 0;

    // Cost (last 30 days) - rough estimate based on tokens
    const costResult = db
      .prepare(
        "SELECT SUM(tokens_in + tokens_out) as total_tokens FROM call_logs WHERE timestamp >= ?"
      )
      .get(thirtyDaysAgo) as { total_tokens: number | null };

    const prevCostResult = db
      .prepare(
        "SELECT SUM(tokens_in + tokens_out) as total_tokens FROM call_logs WHERE timestamp >= ? AND timestamp < ?"
      )
      .get(sixtyDaysAgo, thirtyDaysAgo) as { total_tokens: number | null };

    // Rough cost estimate: $0.01 per 1000 tokens
    const totalCost = ((costResult.total_tokens || 0) / 1000) * 0.01;
    const prevCost = ((prevCostResult.total_tokens || 0) / 1000) * 0.01;
    const costTrend = prevCost > 0 ? ((totalCost - prevCost) / prevCost) * 100 : 0;

    // Average latency (last 30 days)
    const latencyResult = db
      .prepare(
        "SELECT AVG(duration) as avg_duration FROM call_logs WHERE timestamp >= ? AND duration > 0"
      )
      .get(thirtyDaysAgo) as { avg_duration: number | null };

    const prevLatencyResult = db
      .prepare(
        "SELECT AVG(duration) as avg_duration FROM call_logs WHERE timestamp >= ? AND timestamp < ? AND duration > 0"
      )
      .get(sixtyDaysAgo, thirtyDaysAgo) as { avg_duration: number | null };

    const avgLatency = latencyResult.avg_duration || 0;
    const prevAvgLatency = prevLatencyResult.avg_duration || 0;
    const latencyTrend =
      prevAvgLatency > 0 ? ((avgLatency - prevAvgLatency) / prevAvgLatency) * 100 : 0;

    return NextResponse.json({
      totalRequests: {
        value: totalResult.count,
        trend: Math.round(totalTrend * 10) / 10,
      },
      todayRequests: {
        value: todayResult.count,
        trend: Math.round(todayTrend * 10) / 10,
      },
      cost30d: {
        value: Math.round(totalCost * 100) / 100,
        trend: Math.round(costTrend * 10) / 10,
      },
      avgLatency: {
        value: Math.round(avgLatency),
        trend: Math.round(latencyTrend * 10) / 10,
      },
    });
  } catch (error) {
    console.error("Error fetching KPI stats:", error);
    return NextResponse.json({ error: "Failed to fetch KPI stats" }, { status: 500 });
  }
}
