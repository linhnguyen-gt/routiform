"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Spinner } from "@/shared/components";

interface ComboHealth {
  name: string;
  requests: number;
  successRate: number;
  avgLatency: number;
  health: string;
}

interface SystemHealth {
  diversityScore: number;
  topCombos: ComboHealth[];
}

function getStatusVariant(health: string) {
  if (health === "healthy") return "success";
  if (health === "degraded") return "warning";
  return "error";
}

function getStatusIcon(health: string) {
  if (health === "healthy") return "check_circle";
  if (health === "degraded") return "warning";
  return "error";
}

export default function SystemHealthCard({ usageRange }: { usageRange: string }) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSystemHealth() {
      try {
        const res = await fetch(`/api/analytics/system-health?range=${usageRange}`);
        if (!res.ok) throw new Error("Failed to fetch system health");
        const data = await res.json();
        setHealth(data);
      } catch (err) {
        console.error("Error fetching system health:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSystemHealth();
  }, [usageRange]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </Card>
    );
  }

  if (!health) {
    return (
      <Card className="p-6">
        <div className="text-center text-text-muted">Failed to load system health</div>
      </Card>
    );
  }

  const diversityColor =
    health.diversityScore >= 8
      ? "text-success"
      : health.diversityScore >= 6
        ? "text-warning"
        : "text-error";

  return (
    <Card className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">
          health_and_safety
        </span>
        <h3 className="text-lg font-semibold text-text">System Health</h3>
      </div>

      {/* Diversity Score */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-muted">Diversity Score</span>
          <span className={`text-3xl font-bold tabular-nums ${diversityColor}`}>
            {health.diversityScore.toFixed(1)}
            <span className="text-lg text-text-muted">/10</span>
          </span>
        </div>
        <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              health.diversityScore >= 8
                ? "bg-success"
                : health.diversityScore >= 6
                  ? "bg-warning"
                  : "bg-error"
            }`}
            style={{ width: `${(health.diversityScore / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* Active Providers */}
      <div className="flex items-center justify-between py-3 border-t border-border">
        <span className="text-sm text-text-muted">Active Providers</span>
        <span className="text-xl font-semibold text-text tabular-nums">
          {health.diversityScore}
        </span>
      </div>

      {/* Top Combos Health */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium text-text-muted">Top Combos Health</h4>
        <div className="flex flex-col gap-2">
          {health.topCombos.length === 0 ? (
            <div className="text-sm text-text-muted text-center py-4">No combo data available</div>
          ) : (
            health.topCombos.map((combo, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      combo.health === "healthy"
                        ? "text-success"
                        : combo.health === "degraded"
                          ? "text-warning"
                          : "text-error"
                    }`}
                    aria-hidden="true"
                  >
                    {getStatusIcon(combo.health)}
                  </span>
                  <span className="text-sm font-medium text-text truncate">{combo.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text tabular-nums">
                    {combo.successRate.toFixed(1)}%
                  </span>
                  <Badge variant={getStatusVariant(combo.health)} size="sm">
                    {combo.health}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
