"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { Model, ProviderGroup } from "../types";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Groups models by provider and filters by a debounced search string.
 * Used by ApiManagerPageClient to prepare data for the PermissionsModal.
 */
export function useModelsByProvider(
  allModels: Model[],
  debouncedSearch: string
): { modelsByProvider: ProviderGroup[]; filteredModelsByProvider: ProviderGroup[] } {
  const t = useTranslations("apiManager");

  // Group models by provider
  const modelsByProvider = useMemo((): ProviderGroup[] => {
    const grouped: Record<string, Model[]> = {};
    for (const model of allModels) {
      const provider = model.owned_by || t("unknownProvider");
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(model);
    }
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allModels, t]);

  // Filter models based on debounced search
  const filteredModelsByProvider = useMemo((): ProviderGroup[] => {
    if (!debouncedSearch.trim()) return modelsByProvider;

    const search = debouncedSearch.toLowerCase();
    return modelsByProvider
      .map(
        ([provider, models]): ProviderGroup => [
          provider,
          models.filter(
            (m) => m.id.toLowerCase().includes(search) || provider.toLowerCase().includes(search)
          ),
        ]
      )
      .filter(([, models]) => models.length > 0);
  }, [modelsByProvider, debouncedSearch]);

  return { modelsByProvider, filteredModelsByProvider };
}
