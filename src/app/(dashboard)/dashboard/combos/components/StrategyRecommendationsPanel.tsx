"use client";

import { Button } from "@/shared/components";
import { useTranslations } from "next-intl";
import { getI18nOrFallback, getStrategyLabel, getStrategyRecommendationText } from "./combo-utils";

interface StrategyRecommendationsPanelProps {
  strategy: string;
  onApply: () => void;
  showNudge: boolean;
}

export function StrategyRecommendationsPanel({
  strategy,
  onApply,
  showNudge,
}: StrategyRecommendationsPanelProps) {
  const t = useTranslations("combos");
  const strategyLabel = getStrategyLabel(t, strategy);
  const title = getStrategyRecommendationText(t, strategy, "title") as string;
  const description = getStrategyRecommendationText(t, strategy, "description") as string;
  const tips = getStrategyRecommendationText(t, strategy, "tips") as string[];

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-text-muted">
            {getI18nOrFallback(t, "recommendationsLabel", "Recommended setup")}
          </p>
          <p className="text-xs font-semibold text-text-main mt-0.5">
            {title} · <span className="text-primary">{strategyLabel}</span>
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">{description}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onApply} className="!h-6 px-2 text-[10px]">
          {getI18nOrFallback(t, "applyRecommendations", "Apply recommendations")}
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1">
        {tips.map((tip, index) => (
          <div
            key={`${strategy}-tip-${index + 1}`}
            className="flex items-start gap-1 rounded-md bg-black/[0.02] dark:bg-white/[0.03] px-1.5 py-1"
          >
            <span className="material-symbols-outlined text-[12px] text-primary mt-0.5">check</span>
            <p className="text-[10px] text-text-main">{tip}</p>
          </div>
        ))}
      </div>

      {showNudge && (
        <div
          data-testid="strategy-change-nudge"
          className="mt-2 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] text-primary"
        >
          {getI18nOrFallback(
            t,
            "recommendationsUpdated",
            "Recommendations updated for {strategy}.",
            {
              strategy: strategyLabel,
            }
          )}
        </div>
      )}
    </div>
  );
}
