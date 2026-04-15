"use client";

import { Button, Card } from "@/shared/components";
import { useTranslations } from "next-intl";
import {
  getI18nOrFallback,
  getStrategyDescription,
  getStrategyLabel,
  getStrategyMeta,
} from "./combo-utils";

interface ComboUsageGuideProps {
  onHide: () => void;
  onHideForever: () => void;
}

export function ComboUsageGuide({ onHide, onHideForever }: ComboUsageGuideProps) {
  const t = useTranslations("combos");
  const guideStrategies = ["priority", "cost-optimized", "least-used"];

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[16px]">
              tips_and_updates
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t("routingStrategy")}</h2>
            <p className="text-xs text-text-muted mt-0.5">{t("description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={onHide} className="!h-6 px-2 text-[10px]">
            {getI18nOrFallback(t, "usageGuideHide", "Hide")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onHideForever}
            className="!h-6 px-2 text-[10px]"
          >
            {getI18nOrFallback(t, "usageGuideDontShowAgain", "Don't show again")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
        {guideStrategies.map((strategyValue) => {
          const strategyMeta = getStrategyMeta(strategyValue);
          return (
            <div
              key={strategyValue}
              className="rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-primary">
                  {strategyMeta.icon}
                </span>
                <span className="text-xs font-medium">{getStrategyLabel(t, strategyValue)}</span>
              </div>
              <p className="text-[11px] leading-4 text-text-muted mt-1.5">
                {getStrategyDescription(t, strategyValue)}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
