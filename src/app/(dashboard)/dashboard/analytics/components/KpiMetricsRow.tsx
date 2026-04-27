"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@/shared/components";

interface KpiMetric {
  icon: string;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  loading?: boolean;
}

interface KpiStats {
  totalRequests: {
    value: number;
    trend: number;
  };
  todayRequests: {
    value: number;
    trend: number;
  };
  cost30d: {
    value: number;
    trend: number;
  };
  avgLatency: {
    value: number;
    trend: number;
  };
}

function KpiCard({ icon, label, value, trend, loading }: KpiMetric) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-text-muted text-sm">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      {loading ? (
        <div className="h-8 flex items-center">
          <Spinner size="sm" />
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-text tabular-nums">{value}</div>
          {trend && (
            <div
              className={`flex items-center gap-1 text-xs ${
                trend.direction === "up"
                  ? "text-success"
                  : trend.direction === "down"
                    ? "text-error"
                    : "text-text-muted"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                {trend.direction === "up"
                  ? "trending_up"
                  : trend.direction === "down"
                    ? "trending_down"
                    : "trending_flat"}
              </span>
              <span>{trend.value}</span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function KpiMetricsRow() {
  const [stats, setStats] = useState<KpiStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKpiStats() {
      try {
        const res = await fetch("/api/analytics/kpi-stats");
        if (!res.ok) throw new Error("Failed to fetch KPI stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Error fetching KPI stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchKpiStats();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatCost = (cost: number) => `$${cost.toFixed(2)}`;
  const formatLatency = (ms: number) => `${Math.round(ms)}ms`;

  const formatTrend = (value: number): { value: string; direction: "up" | "down" | "neutral" } => {
    const abs = Math.abs(value);
    const formatted = `${abs.toFixed(1)}%`;
    if (value > 0) return { value: `+${formatted}`, direction: "up" };
    if (value < 0) return { value: formatted, direction: "down" };
    return { value: "0%", direction: "neutral" };
  };

  const metrics: KpiMetric[] = [
    {
      icon: "query_stats",
      label: "Total Requests",
      value: stats ? formatNumber(stats.totalRequests.value) : "—",
      trend: stats ? formatTrend(stats.totalRequests.trend) : undefined,
      loading,
    },
    {
      icon: "today",
      label: "Today",
      value: stats ? formatNumber(stats.todayRequests.value) : "—",
      trend: stats ? formatTrend(stats.todayRequests.trend) : undefined,
      loading,
    },
    {
      icon: "payments",
      label: "Cost (30d)",
      value: stats ? formatCost(stats.cost30d.value) : "—",
      trend: stats ? formatTrend(stats.cost30d.trend) : undefined,
      loading,
    },
    {
      icon: "speed",
      label: "Avg Latency",
      value: stats ? formatLatency(stats.avgLatency.value) : "—",
      trend: stats
        ? {
            ...formatTrend(stats.avgLatency.trend),
            direction:
              stats.avgLatency.trend > 0 ? "down" : stats.avgLatency.trend < 0 ? "up" : "neutral",
          }
        : undefined,
      loading,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {metrics.map((metric, idx) => (
        <KpiCard key={idx} {...metric} />
      ))}
    </div>
  );
}
