"use client";

import { useTranslations } from "next-intl";

interface CompatibleProvidersEmptyStateProps {
  onAddOpenAI: () => void;
  onAddAnthropic: () => void;
}

/**
 * Empty state shown when no compatible providers are configured.
 * Uses SVG icon (not emoji) per UI/UX pro max guidelines.
 */
export function CompatibleProvidersEmptyState({
  onAddOpenAI,
  onAddAnthropic,
}: CompatibleProvidersEmptyStateProps) {
  const t = useTranslations("providers");

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 border border-dashed border-border rounded-xl bg-bg-subtle/50">
      <div className="flex items-center justify-center size-14 rounded-2xl bg-orange-500/10 mb-4">
        <span className="material-symbols-outlined text-orange-500 text-[28px]" aria-hidden="true">
          extension
        </span>
      </div>
      <h3 className="font-semibold text-text-main mb-1">{t("noCompatibleYet")}</h3>
      <p className="text-sm text-text-muted text-center max-w-xs mb-5 leading-relaxed">
        {t("compatibleHint")}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onAddOpenAI}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            add
          </span>
          {t("addOpenAICompatible")}
        </button>
        <button
          onClick={onAddAnthropic}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-subtle text-text-muted text-sm font-medium hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer border border-border"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            add
          </span>
          {t("addAnthropicCompatible")}
        </button>
      </div>
    </div>
  );
}
