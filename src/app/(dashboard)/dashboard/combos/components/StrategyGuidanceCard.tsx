"use client";

import { useTranslations } from "next-intl";
import { getI18nOrFallback, getStrategyGuideText } from "./combo-utils";

interface StrategyGuidanceCardProps {
  strategy: string;
}

export function StrategyGuidanceCard({ strategy }: StrategyGuidanceCardProps) {
  const t = useTranslations("combos");
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-2.5">
      <div className="text-[11px] text-text-muted">
        {getI18nOrFallback(t, "strategyGuideTitle", "How to use this strategy")}
      </div>
      <div className="mt-1.5 flex flex-col gap-1.5 text-[11px]">
        <p className="text-text-main">
          <span className="font-semibold">
            {getI18nOrFallback(t, "strategyGuideWhen", "When to use")}:
          </span>{" "}
          {getStrategyGuideText(t, strategy, "when")}
        </p>
        <p className="text-text-main">
          <span className="font-semibold">
            {getI18nOrFallback(t, "strategyGuideAvoid", "Avoid when")}:
          </span>{" "}
          {getStrategyGuideText(t, strategy, "avoid")}
        </p>
        <p className="text-text-main">
          <span className="font-semibold">
            {getI18nOrFallback(t, "strategyGuideExample", "Example")}:
          </span>{" "}
          {getStrategyGuideText(t, strategy, "example")}
        </p>
      </div>
    </div>
  );
}
