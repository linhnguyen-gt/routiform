"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import ProviderIcon from "@/shared/components/ProviderIcon";

interface ProviderStat {
  id: string;
  provider: {
    id: string;
    name: string;
    color?: string;
    alias?: string;
  };
  total: number;
  connected: number;
  warnings: number;
  errors: number;
  modelCount: number;
  authType: "free" | "oauth" | "apikey";
}

interface ProviderMetrics {
  totalRequests?: number;
  totalSuccesses?: number;
  successRate?: number;
  avgLatencyMs?: number;
}

interface ProvidersOverviewProps {
  providerStats: ProviderStat[];
  providerMetrics: Record<string, ProviderMetrics>;
  onProviderClick: (provider: ProviderStat) => void;
}

export default function ProvidersOverview({
  providerStats,
  providerMetrics,
  onProviderClick,
}: ProvidersOverviewProps) {
  const t = useTranslations("home");
  const tc = useTranslations("common");

  const configuredCount = providerStats.filter((item) => item.total > 0).length;

  return (
    <div className="rounded-xl border-2 border-border bg-surface p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-main">{t("providersOverview")}</h2>
          <p className="text-sm text-text-muted mt-1">
            {t("configuredOf", {
              configured: configuredCount,
              total: providerStats.length,
            })}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden lg:flex items-center gap-4 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              <span>{tc("free")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>{t("oauthLabel")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>{t("apiKeyLabel")}</span>
            </div>
          </div>

          <Link
            href="/dashboard/providers"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-border text-sm font-semibold text-text-muted hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {tc("manage")}
          </Link>
        </div>
      </div>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {providerStats.map((item) => (
          <ProviderCard
            key={item.id}
            item={item}
            metrics={providerMetrics[item.provider.alias] || providerMetrics[item.id]}
            onClick={() => onProviderClick(item)}
          />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  item,
  metrics,
  onClick,
}: {
  item: ProviderStat;
  metrics?: ProviderMetrics;
  onClick: () => void;
}) {
  const t = useTranslations("home");
  const tc = useTranslations("common");

  const statusVariant =
    item.errors > 0
      ? "text-red-400"
      : item.warnings > 0
        ? "text-amber-400"
        : item.connected > 0
          ? "text-green-400"
          : "text-text-muted";

  const authTypeConfig = {
    free: { color: "bg-green-500", label: tc("free") },
    oauth: { color: "bg-blue-500", label: t("oauthLabel") },
    apikey: { color: "bg-amber-500", label: t("apiKeyLabel") },
  };
  const authInfo = authTypeConfig[item.authType] || authTypeConfig.apikey;

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border-2 border-border bg-surface-hover p-4 text-left transition-all duration-200 hover:border-blue-500/50 hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="relative z-10 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${item.provider.color || "#888"}15` }}
          >
            <ProviderIcon providerId={item.provider.id} size={28} type="color" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-text-main truncate group-hover:text-blue-400 transition-colors duration-200">
                {item.provider.name}
              </h3>
              <span
                className={`w-2 h-2 rounded-full ${authInfo.color} shrink-0`}
                title={authInfo.label}
              />
            </div>
            <p className={`text-xs font-semibold ${statusVariant}`}>
              {item.total === 0
                ? tc("notConfigured")
                : item.errors > 0
                  ? t("activeError", { active: item.connected, errors: item.errors })
                  : item.warnings > 0
                    ? `${item.connected} ${tc("active")} · ${item.warnings} ${tc("warning")}`
                    : `${item.connected} ${tc("active")}`}
            </p>
          </div>
        </div>

        {/* Metrics */}
        {metrics && metrics.totalRequests > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <div className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs font-semibold text-green-400">{metrics.totalSuccesses}</span>
              <span className="text-xs text-text-muted">/ {metrics.totalRequests}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-xs font-semibold text-blue-400">{metrics.successRate}%</span>
            </div>
            <div className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5 text-violet-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs font-semibold text-violet-400">
                ~{metrics.avgLatencyMs}ms
              </span>
            </div>
          </div>
        )}

        {/* Model Count */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-text-muted">{tc("models")}</span>
          <span className="text-sm font-bold text-text-main">{item.modelCount}</span>
        </div>
      </div>

      {/* Hover Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-violet-500/0 group-hover:from-blue-500/5 group-hover:to-violet-500/5 transition-all duration-300 pointer-events-none"></div>

      {/* Arrow Icon */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <svg
          className="w-5 h-5 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7l5 5m0 0l-5 5m5-5H6"
          />
        </svg>
      </div>
    </button>
  );
}
