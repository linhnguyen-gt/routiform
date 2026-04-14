"use client";

import { Card } from "@/shared/components";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProvidersStatsCardsProps {
  totalProviders: number;
  connectedCount: number;
  errorCount: number;
  compatibleCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProvidersStatsCards({
  totalProviders,
  connectedCount,
  errorCount,
  compatibleCount,
}: ProvidersStatsCardsProps) {
  const t = useTranslations("providers");

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-indigo-500/10">
            <span className="material-symbols-outlined text-indigo-500 text-lg" aria-hidden="true">
              dns
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold">{totalProviders}</p>
            <p className="text-xs text-text-muted">{t("totalProviders")}</p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-500/10">
            <span className="material-symbols-outlined text-emerald-500 text-lg" aria-hidden="true">
              check_circle
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold">{connectedCount}</p>
            <p className="text-xs text-text-muted">{t("connectedLabel")}</p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-red-500/10">
            <span className="material-symbols-outlined text-red-500 text-lg" aria-hidden="true">
              error
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold">{errorCount}</p>
            <p className="text-xs text-text-muted">{t("errorLabel")}</p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-orange-500/10">
            <span className="material-symbols-outlined text-orange-500 text-lg" aria-hidden="true">
              extension
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold">{compatibleCount}</p>
            <p className="text-xs text-text-muted">{t("compatibleLabel")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
