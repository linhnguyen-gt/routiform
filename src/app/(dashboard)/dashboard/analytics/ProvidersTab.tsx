"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import ProviderIcon from "@/shared/components/ProviderIcon";
import TimeRangeSelector from "@/shared/components/analytics/TimeRangeSelector";
import { Spinner } from "@/shared/components/Loading";
import ProviderQuotaCards from "./components/ProviderQuotaCards";
import type {
  ProviderUtilizationPoint,
  ProviderUtilizationResponse,
  ComboHealthMetrics,
  UtilizationTimeRange,
} from "@/shared/types/utilization";

interface ProviderQuotaSnapshot {
  provider: string;
  remainingPct: number;
  isExhausted: boolean;
  lastUpdated: string;
}

const PROVIDER_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-error)",
  "var(--color-text-muted)",
];

function formatTimestamp(value: string, range: UtilizationTimeRange) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  if (range === "1h" || range === "24h") {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

function formatShare(value: number) {
  return formatPercent(value * 100, 1);
}

function formatLatency(value: number) {
  return `${Math.round(value).toLocaleString()}ms`;
}

function getTrendMeta(trend: "improving" | "declining" | "stable") {
  if (trend === "improving") {
    return {
      icon: "trending_up",
      label: "Improving",
      variant: "success" as const,
    };
  }
  if (trend === "declining") {
    return {
      icon: "trending_down",
      label: "Declining",
      variant: "warning" as const,
    };
  }
  return {
    icon: "trending_flat",
    label: "Stable",
    variant: "default" as const,
  };
}

export default function ProvidersTab() {
  const [range, setRange] = useState<UtilizationTimeRange>("24h");
  const [utilizationData, setUtilizationData] = useState<ProviderUtilizationResponse | null>(null);
  const [comboHealth, setComboHealth] = useState<ComboHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [utilRes, healthRes] = await Promise.all([
        fetch(`/api/analytics/provider-utilization?range=${range}`),
        fetch(`/api/usage/combo-health?range=${range}`),
      ]);

      if (utilRes.ok) {
        const utilData = await utilRes.json();
        setUtilizationData(utilData);
      }

      if (healthRes.ok) {
        const healthData = await healthRes.json();
        const combos = Array.isArray(healthData?.combos) ? healthData.combos : [];

        if (combos.length === 0) {
          setComboHealth(null);
        } else {
          const mergedProviders = new Map<
            string,
            ComboHealthMetrics["quotaHealth"]["providers"][number]
          >();

          combos.forEach((combo: ComboHealthMetrics) => {
            combo.quotaHealth.providers.forEach((provider) => {
              const existing = mergedProviders.get(provider.provider);
              if (!existing || provider.remainingPct > existing.remainingPct) {
                mergedProviders.set(provider.provider, provider);
              }
            });
          });

          const mergedQuotaProviders = Array.from(mergedProviders.values());

          setComboHealth({
            ...combos[0],
            quotaHealth: {
              providers: mergedQuotaProviders,
              worstRemainingPct:
                mergedQuotaProviders.length > 0
                  ? Math.min(...mergedQuotaProviders.map((provider) => provider.remainingPct))
                  : 0,
            },
          });
        }
      }
    } catch (error) {
      console.error("Error fetching provider data:", error);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = useMemo(() => {
    if (!utilizationData?.data) return [];
    return utilizationData.data;
  }, [utilizationData]);

  const providers = useMemo(() => {
    if (!utilizationData?.providers) return [];
    return utilizationData.providers;
  }, [utilizationData]);

  const providerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    providers.forEach((provider, idx) => {
      map[provider] = PROVIDER_COLORS[idx % PROVIDER_COLORS.length];
    });
    return map;
  }, [providers]);

  const providerSnapshots = useMemo((): ProviderQuotaSnapshot[] => {
    if (!providers.length || !utilizationData?.data?.length) return [];

    const latestPoint = utilizationData.data[utilizationData.data.length - 1] as
      | (ProviderUtilizationPoint & Record<string, string | number>)
      | undefined;

    if (!latestPoint) return [];

    return providers.map((provider) => {
      const share =
        typeof latestPoint[provider] === "number" ? (latestPoint[provider] as number) : 0;
      return {
        provider,
        remainingPct: share,
        isExhausted: share === 0,
        lastUpdated:
          typeof latestPoint.timestamp === "string"
            ? latestPoint.timestamp
            : new Date().toISOString(),
      };
    });
  }, [providers, utilizationData]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">Provider Performance</h2>
          <p className="text-sm text-text-muted mt-1">
            Utilization trends and health metrics across all providers
          </p>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {/* Utilization Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
            <h3 className="text-lg font-semibold text-text">Provider Utilization Over Time</h3>
          </div>
          {!loading && chartData.length > 0 && (
            <div className="text-xs text-text-muted">
              Showing {providers.length} provider{providers.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-80">
            <Spinner />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-text-muted">
            <span className="material-symbols-outlined text-[48px] opacity-50 mb-2">
              show_chart
            </span>
            <p className="text-sm">No utilization data available for this time range</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
              <defs>
                {providers.map((provider) => (
                  <linearGradient
                    key={provider}
                    id={`color-${provider}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={providerColorMap[provider]} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={providerColorMap[provider]} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => formatTimestamp(value, range)}
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={52}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                labelStyle={{ color: "var(--color-text)", fontWeight: 600, marginBottom: "4px" }}
                itemStyle={{ color: "var(--color-text)", fontSize: "12px" }}
                formatter={(value: number) => `${value.toFixed(1)}%`}
                labelFormatter={(value) => formatTimestamp(value, range)}
              />
              <Legend
                wrapperStyle={{ paddingTop: "16px" }}
                iconType="circle"
                iconSize={10}
                formatter={(value) => (
                  <span style={{ color: "var(--color-text)", fontSize: "12px", marginLeft: "4px" }}>
                    {value}
                  </span>
                )}
              />
              {providers.map((provider) => (
                <Area
                  key={provider}
                  type="monotone"
                  dataKey={provider}
                  stackId="1"
                  stroke={providerColorMap[provider]}
                  fill={`url(#color-${provider})`}
                  strokeWidth={1.5}
                  name={provider}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Provider Quota Snapshots */}
      {providerSnapshots.length > 0 && <ProviderQuotaCards snapshots={providerSnapshots} />}

      {/* Combo Health Metrics */}
      {comboHealth && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quota Health */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-[20px]">data_usage</span>
              <h3 className="text-lg font-semibold text-text">Quota Health</h3>
            </div>
            <div className="flex flex-col gap-3">
              {comboHealth.quotaHealth.providers
                .filter((p) => p.name && p.name.trim() !== "")
                .map((provider, idx) => {
                  const trendMeta = getTrendMeta(provider.trend);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary"
                    >
                      <div className="flex items-center gap-3">
                        <ProviderIcon providerId={provider.name} size={24} />
                        <div>
                          <div className="font-medium text-text">{provider.name}</div>
                          <div className="text-xs text-text-muted">
                            {formatShare(provider.share)} of traffic
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={trendMeta.variant} size="sm">
                          <span className="material-symbols-outlined text-[14px] mr-1">
                            {trendMeta.icon}
                          </span>
                          {trendMeta.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          {/* Performance Metrics */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-[20px]">speed</span>
              <h3 className="text-lg font-semibold text-text">Performance</h3>
            </div>
            <div className="grid gap-4">
              <div className="p-4 rounded-lg bg-surface-secondary">
                <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Avg Latency
                </div>
                <div className="text-2xl font-bold text-text">
                  {formatLatency(comboHealth.performance.avgLatencyMs)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-surface-secondary">
                <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Success Rate
                </div>
                <div className="text-2xl font-bold text-text">
                  {formatPercent(comboHealth.performance.successRate, 1)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-surface-secondary">
                <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Total Requests
                </div>
                <div className="text-2xl font-bold text-text">
                  {comboHealth.performance.totalRequests.toLocaleString()}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
