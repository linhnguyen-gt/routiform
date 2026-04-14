import { useTranslations } from "next-intl";
import {
  STRATEGY_GUIDANCE_FALLBACK,
  STRATEGY_OPTIONS,
  STRATEGY_RECOMMENDATIONS_FALLBACK,
} from "./combo-constants";
import { hasTranslation } from "./combo-data";

type Translator = ReturnType<typeof useTranslations>;

export function getStrategyMeta(strategy: string) {
  return STRATEGY_OPTIONS.find((option) => option.value === strategy) || STRATEGY_OPTIONS[0];
}

export function getStrategyLabel(t: Translator, strategy: string): string {
  return t(getStrategyMeta(strategy).labelKey);
}

export function getStrategyDescription(t: Translator, strategy: string): string {
  return t(getStrategyMeta(strategy).descKey);
}

export function getStrategyBadgeClass(strategy: string): string {
  if (strategy === "weighted") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (strategy === "round-robin") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (strategy === "random") return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
  if (strategy === "least-used") return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400";
  if (strategy === "cost-optimized") return "bg-teal-500/15 text-teal-600 dark:text-teal-400";
  if (strategy === "fill-first") return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
  if (strategy === "p2c") return "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400";
  return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
}

export function getI18nOrFallback(
  t: Translator,
  key: Parameters<Translator>[0] & string,
  fallback: string,
  values?: Record<string, string | number>
): string {
  if (hasTranslation(t, key)) {
    return values ? t(key, values) : t(key);
  }

  if (!values) {
    return fallback;
  }

  let text = String(fallback);
  for (const [token, value] of Object.entries(values)) {
    text = text.replaceAll(`{${token}}`, String(value));
  }
  return text;
}

export function getStrategyGuideText(
  t: Translator,
  strategy: string,
  field: "when" | "avoid" | "example"
): string {
  const strategyFallback =
    STRATEGY_GUIDANCE_FALLBACK[strategy] || STRATEGY_GUIDANCE_FALLBACK.priority;
  return getI18nOrFallback(t, `strategyGuide.${strategy}.${field}`, strategyFallback[field]);
}

export function getStrategyRecommendationText(
  t: Translator,
  strategy: string,
  field: "title" | "description" | "tips"
): string | string[] {
  const strategyFallback =
    STRATEGY_RECOMMENDATIONS_FALLBACK[strategy] || STRATEGY_RECOMMENDATIONS_FALLBACK.priority;

  if (field === "tips") {
    return strategyFallback.tips.map((tip, index) =>
      getI18nOrFallback(t, `strategyRecommendations.${strategy}.tip${index + 1}`, tip)
    );
  }

  return getI18nOrFallback(
    t,
    `strategyRecommendations.${strategy}.${field}`,
    strategyFallback[field]
  );
}
