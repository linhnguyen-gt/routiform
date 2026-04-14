"use client";

import { Card } from "@/shared/components";

interface ProviderDetailSearchSectionProps {
  t: any;
  isSearchProvider: boolean;
  providerId: string;
}

export function ProviderDetailSearchSection({
  t,
  isSearchProvider,
  providerId,
}: ProviderDetailSearchSectionProps) {
  if (!isSearchProvider) return null;

  return (
    <Card className="rounded-xl border-border/50 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-text-muted/70" aria-hidden>
          search
        </span>
        <h2 className="text-lg font-semibold tracking-tight">{t("searchProvider")}</h2>
      </div>
      <p className="text-sm leading-relaxed text-text-muted">{t("searchProviderDesc")}</p>
      {providerId === "perplexity-search" && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3">
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-sm text-blue-400">
            link
          </span>
          <p className="text-xs leading-relaxed text-blue-200/90">
            Uses the same API key as <strong>Perplexity</strong> (chat provider). If you already
            have Perplexity configured, no additional setup is needed.
          </p>
        </div>
      )}
    </Card>
  );
}
