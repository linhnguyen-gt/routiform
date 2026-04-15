"use client";

import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProvidersHeroHeaderProps {
  totalProviders: number;
  connectedCount: number;
  onTestAll: () => void;
  testing: boolean;
  onImportZed: () => void;
  importingZed: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProvidersHeroHeader({
  totalProviders,
  connectedCount,
  onTestAll,
  testing,
  onImportZed,
  importingZed,
}: ProvidersHeroHeaderProps) {
  const t = useTranslations("providers");
  const tc = useTranslations("common");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 via-indigo-600 to-blue-700 p-8 shadow-xl">
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">{t("providers")}</h1>
            <p className="text-base text-indigo-100/80 leading-relaxed max-w-2xl">
              {t("heroSubtitle", {
                total: totalProviders,
                connected: connectedCount,
              })}
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <span className="material-symbols-outlined text-emerald-300 text-lg" aria-hidden="true">
              verified
            </span>
            <span className="text-sm font-semibold text-white">
              {connectedCount}/{totalProviders} {tc("connected")}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onTestAll}
            disabled={testing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-indigo-700 font-semibold text-sm hover:bg-indigo-50 active:scale-95 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${testing ? "animate-spin" : ""}`}
              aria-hidden="true"
            >
              {testing ? "sync" : "play_arrow"}
            </span>
            {testing ? t("testing") : t("testAllProviders")}
          </button>
          <button
            onClick={onImportZed}
            disabled={importingZed}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold text-sm hover:bg-white/20 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${importingZed ? "animate-spin" : ""}`}
              aria-hidden="true"
            >
              {importingZed ? "sync" : "download"}
            </span>
            {importingZed ? "Importing..." : "Import from Zed"}
          </button>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
    </div>
  );
}
