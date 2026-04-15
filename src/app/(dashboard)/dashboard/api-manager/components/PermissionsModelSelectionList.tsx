"use client";

import { Input } from "@/shared/components";
import { useTranslations } from "next-intl";

import type { Model, ProviderGroup } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionsModelSelectionListProps {
  modelsByProvider: ProviderGroup[];
  selectedModels: string[];
  expandedProviders: Set<string>;
  searchModel: string;
  onSearchChange: (v: string) => void;
  onToggleModel: (modelId: string) => void;
  onToggleProvider: (provider: string, models: Model[]) => void;
  onToggleExpand: (provider: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionsModelSelectionList({
  modelsByProvider,
  selectedModels,
  expandedProviders,
  searchModel,
  onSearchChange,
  onToggleModel,
  onToggleProvider,
  onToggleExpand,
}: PermissionsModelSelectionListProps) {
  const t = useTranslations("apiManager");

  return (
    <>
      <div className="relative">
        <Input
          value={searchModel}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("searchModels")}
          icon="search"
        />
        {searchModel && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      <div className="max-h-[280px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
        {modelsByProvider.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-text-muted">
            <span className="material-symbols-outlined text-2xl mb-1">search_off</span>
            <p className="text-xs">{t("noModelsFound")}</p>
          </div>
        ) : (
          modelsByProvider.map(([provider, models]) => {
            const selectedInProvider = selectedModels.filter((m) =>
              models.some((model) => model.id === m)
            ).length;
            const allSelected = models.every((m) => selectedModels.includes(m.id));
            const someSelected = selectedInProvider > 0 && !allSelected;

            return (
              <div key={provider} className="group">
                <button
                  onClick={() => onToggleExpand(provider)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface/50 transition-colors text-left"
                >
                  <span
                    className={`material-symbols-outlined text-base transition-transform duration-200 ${
                      expandedProviders.has(provider) ? "rotate-90" : ""
                    }`}
                  >
                    chevron_right
                  </span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="relative flex items-center cursor-pointer shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleProvider(provider, models);
                      }}
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 transition-colors flex items-center justify-center ${
                          allSelected
                            ? "bg-primary border-primary"
                            : someSelected
                              ? "bg-primary/20 border-primary"
                              : "border-border hover:border-primary/50"
                        }`}
                      >
                        {allSelected && (
                          <span className="material-symbols-outlined text-white text-[12px]">
                            check
                          </span>
                        )}
                        {someSelected && !allSelected && (
                          <span className="material-symbols-outlined text-primary text-[12px]">
                            remove
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-text-main truncate">
                      {provider}
                    </span>
                    <span className="text-[10px] text-text-muted bg-surface px-1 py-0.5 rounded shrink-0">
                      {models.length}
                    </span>
                  </div>
                  {selectedInProvider > 0 && (
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                      {selectedInProvider}
                    </span>
                  )}
                </button>

                {/* Expandable model list */}
                {expandedProviders.has(provider) && (
                  <div className="px-3 pb-2 pl-9">
                    <div className="flex flex-wrap gap-1">
                      {models.map((model) => {
                        const isSelected = selectedModels.includes(model.id);
                        return (
                          <button
                            key={model.id}
                            onClick={() => onToggleModel(model.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono transition-all ${
                              isSelected
                                ? "bg-primary text-white"
                                : "bg-surface border border-border text-text-muted hover:border-primary/50 hover:text-text-main"
                            }`}
                            title={model.id}
                          >
                            {model.id}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
