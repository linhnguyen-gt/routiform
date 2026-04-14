"use client";

import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionsModelSummaryProps {
  selectedModels: string[];
  selectedCount: number;
  onToggleModel: (modelId: string) => void;
  onSelectAllModels: () => void;
  onDeselectAllModels: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionsModelSummary({
  selectedModels,
  selectedCount,
  onToggleModel,
  onSelectAllModels,
  onDeselectAllModels,
}: PermissionsModelSummaryProps) {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");

  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-primary/5 rounded-lg border border-primary/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-primary">
          {t("selectedCount", { count: selectedCount })}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onSelectAllModels}
            className="text-[10px] text-primary hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors"
          >
            {tc("all")}
          </button>
          <button
            onClick={onDeselectAllModels}
            className="text-[10px] text-red-500 hover:bg-red-500/10 px-1.5 py-0.5 rounded transition-colors"
          >
            {t("clear")}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto content-start">
        {selectedModels.map((modelId) => (
          <span
            key={modelId}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white dark:bg-surface text-text-main text-[10px] rounded border border-border"
          >
            <span className="font-mono truncate max-w-[120px]" title={modelId}>
              {modelId}
            </span>
            <button
              onClick={() => onToggleModel(modelId)}
              className="text-text-muted hover:text-red-500 transition-colors"
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
