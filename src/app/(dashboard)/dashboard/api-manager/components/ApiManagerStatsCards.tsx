"use client";

import { Card } from "@/shared/components";
import { useTranslations } from "next-intl";

import type { ApiKeyFull, KeyUsageStats, Model } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApiManagerStatsCardsProps {
  keys: ApiKeyFull[];
  usageStats: Record<string, KeyUsageStats>;
  allModels: Model[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApiManagerStatsCards({ keys, usageStats, allModels }: ApiManagerStatsCardsProps) {
  const t = useTranslations("apiManager");

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10">
            <span className="material-symbols-outlined text-primary text-lg">vpn_key</span>
          </div>
          <div>
            <p className="text-2xl font-bold">{keys.length}</p>
            <p className="text-xs text-text-muted">{t("totalKeys")}</p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-amber-500/10">
            <span className="material-symbols-outlined text-amber-500 text-lg">lock</span>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {
                keys.filter((k) => Array.isArray(k.allowedModels) && k.allowedModels.length > 0)
                  .length
              }
            </p>
            <p className="text-xs text-text-muted">{t("restricted")}</p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-blue-500/10">
            <span className="material-symbols-outlined text-blue-500 text-lg">bar_chart</span>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {Object.values(usageStats).reduce((sum, s) => sum + s.totalRequests, 0)}
            </p>
            <p className="text-xs text-text-muted">{t("totalRequests")}</p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-500/10">
            <span className="material-symbols-outlined text-emerald-500 text-lg">
              model_training
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold">{allModels.length}</p>
            <p className="text-xs text-text-muted">{t("modelsAvailable")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
