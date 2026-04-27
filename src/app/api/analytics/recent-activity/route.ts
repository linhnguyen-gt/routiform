import { NextResponse } from "next/server";
import { getDbInstance } from "@/lib/db/core";

export const dynamic = "force-dynamic";

interface Activity {
  id: string;
  type: "spike" | "warning" | "improvement" | "error" | "info";
  message: string;
  timestamp: string;
  metadata?: {
    value?: string;
    change?: string;
  };
}

export async function GET() {
  try {
    const db = getDbInstance();
    const activities: Activity[] = [];

    // Check for request spikes (last hour vs previous hour)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    const lastHourCount = db
      .prepare("SELECT COUNT(*) as count FROM call_logs WHERE timestamp >= ?")
      .get(oneHourAgo) as { count: number };

    const prevHourCount = db
      .prepare("SELECT COUNT(*) as count FROM call_logs WHERE timestamp >= ? AND timestamp < ?")
      .get(twoHoursAgo, oneHourAgo) as { count: number };

    if (prevHourCount.count > 0 && lastHourCount.count > prevHourCount.count * 1.5) {
      const change = Math.round(
        ((lastHourCount.count - prevHourCount.count) / prevHourCount.count) * 100
      );
      activities.push({
        id: `spike-${Date.now()}`,
        type: "spike",
        message: "Request volume spike detected",
        timestamp: oneHourAgo,
        metadata: {
          value: `${lastHourCount.count} requests`,
          change: `+${change}%`,
        },
      });
    }

    // Check for high error rate (last 30 minutes)
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const recentErrors = db
      .prepare(
        `SELECT COUNT(*) as error_count,
                (SELECT COUNT(*) FROM call_logs WHERE timestamp >= ?) as total_count
         FROM call_logs
         WHERE timestamp >= ? AND (status >= 400 OR status IS NULL)`
      )
      .get(thirtyMinAgo, thirtyMinAgo) as { error_count: number; total_count: number };

    if (recentErrors.total_count > 10) {
      const errorRate = (recentErrors.error_count / recentErrors.total_count) * 100;
      if (errorRate > 5) {
        activities.push({
          id: `error-${Date.now()}`,
          type: "warning",
          message: "Elevated error rate detected",
          timestamp: thirtyMinAgo,
          metadata: {
            value: `${errorRate.toFixed(1)}% errors`,
          },
        });
      }
    }

    // Check for latency improvements (last 24h vs previous 24h)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const recentLatency = db
      .prepare("SELECT AVG(duration) as avg FROM call_logs WHERE timestamp >= ? AND duration > 0")
      .get(oneDayAgo) as { avg: number | null };

    const prevLatency = db
      .prepare(
        "SELECT AVG(duration) as avg FROM call_logs WHERE timestamp >= ? AND timestamp < ? AND duration > 0"
      )
      .get(twoDaysAgo, oneDayAgo) as { avg: number | null };

    if (recentLatency.avg && prevLatency.avg && recentLatency.avg < prevLatency.avg * 0.8) {
      const improvement = Math.round(
        ((prevLatency.avg - recentLatency.avg) / prevLatency.avg) * 100
      );
      activities.push({
        id: `improvement-${Date.now()}`,
        type: "improvement",
        message: "Response time improved",
        timestamp: oneDayAgo,
        metadata: {
          value: `${Math.round(recentLatency.avg)}ms avg`,
          change: `-${improvement}%`,
        },
      });
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      activities: activities.slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return NextResponse.json({ error: "Failed to fetch recent activity" }, { status: 500 });
  }
}
