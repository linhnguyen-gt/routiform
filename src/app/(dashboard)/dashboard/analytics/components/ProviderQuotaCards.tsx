"use client";

import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import ProviderIcon from "@/shared/components/ProviderIcon";

interface ProviderQuotaSnapshot {
  provider: string;
  remainingPct: number;
  isExhausted: boolean;
  lastUpdated: string;
}

interface ProviderQuotaCardsProps {
  snapshots: ProviderQuotaSnapshot[];
}

function getCanonicalProvider(provider: string) {
  const normalized = provider.trim().toLowerCase();

  if (normalized.startsWith("github")) return "github";
  if (normalized.startsWith("codex")) return "codex";
  if (normalized.startsWith("kiro")) return "kiro";
  if (normalized.startsWith("openai")) return "openai";
  if (normalized.startsWith("nvidia")) return "nvidia";
  if (normalized.startsWith("xiaomi")) return "xiaomi";
  if (normalized.startsWith("kilo-gateway")) return "kilo-gateway";
  if (normalized.startsWith("t42-imagen3")) return "t42-imagen3";
  if (normalized.startsWith("nanobanana")) return "nanobanana";
  if (normalized.startsWith("antigravity")) return "antigravity";

  return normalized;
}

function getProviderLabel(provider: string) {
  const canonical = getCanonicalProvider(provider);

  if (canonical === "t42-imagen3") return "t42-imagen3";
  if (canonical === "xiaomi") return "xiaomi";

  return canonical;
}

function getStatusBadge(remainingPct: number, isExhausted: boolean) {
  if (isExhausted || remainingPct === 0) {
    return { label: "Exhausted", variant: "error" as const };
  }
  if (remainingPct < 20) {
    return { label: "Low", variant: "warning" as const };
  }
  if (remainingPct < 50) {
    return { label: "Medium", variant: "info" as const };
  }
  return { label: "Healthy", variant: "success" as const };
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return timestamp;
  }
}

export default function ProviderQuotaCards({ snapshots }: ProviderQuotaCardsProps) {
  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {snapshots.map((snapshot, idx) => {
        const status = getStatusBadge(snapshot.remainingPct, snapshot.isExhausted);

        return (
          <Card key={idx} className="p-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <ProviderIcon providerId={getCanonicalProvider(snapshot.provider)} size={32} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-text truncate">
                  {getProviderLabel(snapshot.provider)}
                </div>
                <div className="text-xs text-text-muted">Latest utilization snapshot</div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="mb-3">
              <Badge variant={status.variant} size="sm">
                {status.label}
              </Badge>
            </div>

            {/* Remaining Percentage */}
            <div className="mb-4">
              <div className="text-3xl font-bold text-text tabular-nums">
                {snapshot.remainingPct.toFixed(1)}%
              </div>
              <div className="text-xs text-text-muted mt-1">Request share</div>
            </div>

            {/* Last Updated */}
            <div className="text-xs text-text-muted mb-3">
              {formatTimestamp(snapshot.lastUpdated)}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>0%</span>
                <span className="text-[10px] uppercase tracking-wide font-medium">
                  Request share
                </span>
                <span>100%</span>
              </div>
              <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${snapshot.remainingPct}%`,
                    backgroundColor:
                      snapshot.remainingPct < 20
                        ? "var(--color-error)"
                        : snapshot.remainingPct < 50
                          ? "var(--color-warning)"
                          : "var(--color-success)",
                  }}
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
