"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";

interface ProviderShare {
  provider: string;
  count: number;
  percentage: number;
}

interface ProviderUtilizationPreviewProps {
  usageRange: string;
  onViewAll?: () => void;
}

export default function ProviderUtilizationPreview({
  usageRange,
  onViewAll,
}: ProviderUtilizationPreviewProps) {
  const [providers, setProviders] = useState<ProviderShare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch(`/api/analytics/provider-share?range=${usageRange}`);
        if (!res.ok) throw new Error("Failed to fetch provider share");
        const data = await res.json();
        setProviders(data.providers);
      } catch (err) {
        console.error("Error fetching provider share:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProviders();
  }, [usageRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <span className="material-symbols-outlined text-[48px] opacity-50 mb-2">cloud_off</span>
        <p className="text-sm">No provider data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...providers.map((p) => p.count));
  const validProviders = providers.filter((p) => p.provider && p.provider.trim() !== "");

  return (
    <div className="flex flex-col gap-2">
      {validProviders.slice(0, 5).map((provider, idx) => (
        <div
          key={idx}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-secondary transition-colors"
        >
          <ProviderIcon providerId={provider.provider} size={28} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-medium text-text truncate">{provider.provider}</span>
              <span className="text-xs text-text-muted tabular-nums">
                {provider.count.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(provider.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-text tabular-nums min-w-[3ch]">
                {provider.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      ))}
      {validProviders.length > 5 && (
        <button
          onClick={onViewAll}
          className="text-xs text-primary hover:text-primary-hover text-center py-2 hover:bg-surface-secondary rounded-lg transition-colors"
        >
          View all {validProviders.length} providers →
        </button>
      )}
    </div>
  );
}
