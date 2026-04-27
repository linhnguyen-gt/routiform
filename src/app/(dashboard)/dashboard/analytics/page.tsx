"use client";

import { useState, Suspense } from "react";
import { UsageAnalytics, CardSkeleton, SegmentedControl } from "@/shared/components";
import EvalsTab from "../usage/components/EvalsTab";
import SearchAnalyticsTab from "./SearchAnalyticsTab";
import ProvidersTab from "./ProvidersTab";
import ProviderUtilizationTab from "./ProviderUtilizationTab";
import ComboHealthTab from "./ComboHealthTab";
import KpiMetricsRow from "./components/KpiMetricsRow";
import SystemHealthCard from "./components/SystemHealthCard";
import RecentActivityFeed from "./components/RecentActivityFeed";
import ProviderUtilizationPreview from "./components/ProviderUtilizationPreview";
import { useTranslations } from "next-intl";

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  /** Shared with UsageAnalytics + Provider Diversity so both use the same usage DB window. */
  const [usageRange, setUsageRange] = useState("30d");
  const t = useTranslations("analytics");

  const tabDescriptions: Record<string, string> = {
    overview: t("overviewDescription"),
    evals: t("evalsDescription"),
    search: "Search request analytics — provider breakdown, cache hit rate, and cost tracking.",
    providers: "Provider utilization trends and health metrics across all providers.",
    utilization:
      "Real-time provider quota tracking with historical trends and capacity monitoring.",
    "combo health": "Monitor combo performance, quota health, usage skew, and routing efficiency.",
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="material-symbols-outlined text-primary text-[28px]" aria-hidden>
            analytics
          </span>
          {t("title")}
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-text-muted">
          {tabDescriptions[activeTab]}
        </p>
      </div>

      <SegmentedControl
        options={[
          { value: "overview", label: t("overview") },
          { value: "evals", label: t("evals") },
          { value: "search", label: "Search" },
          { value: "providers", label: "Providers" },
          { value: "utilization", label: "Utilization" },
          { value: "combo health", label: "Combo Health" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          {/* KPI Metrics Row */}
          <Suspense fallback={<CardSkeleton />}>
            <KpiMetricsRow />
          </Suspense>

          {/* Usage Analytics */}
          <Suspense fallback={<CardSkeleton />}>
            <UsageAnalytics range={usageRange} onRangeChange={setUsageRange} />
          </Suspense>

          {/* Provider Health Grid */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:items-start">
            <Suspense fallback={<CardSkeleton />}>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text mb-4">Provider Utilization</h3>
                <ProviderUtilizationPreview
                  usageRange={usageRange}
                  onViewAll={() => setActiveTab("providers")}
                />
              </div>
            </Suspense>
            <Suspense fallback={<CardSkeleton />}>
              <SystemHealthCard usageRange={usageRange} />
            </Suspense>
          </div>

          {/* Recent Activity Feed */}
          <Suspense fallback={<CardSkeleton />}>
            <RecentActivityFeed />
          </Suspense>
        </div>
      )}
      {activeTab === "evals" && <EvalsTab />}
      {activeTab === "search" && <SearchAnalyticsTab />}
      {activeTab === "providers" && <ProvidersTab />}
      {activeTab === "utilization" && <ProviderUtilizationTab />}
      {activeTab === "combo health" && <ComboHealthTab />}
    </div>
  );
}
