"use client";

import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApiManagerHeroHeaderProps {
  allowKeyReveal: boolean;
  onToggleKeyReveal: () => void;
  onCreateKey: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApiManagerHeroHeader({
  allowKeyReveal,
  onToggleKeyReveal,
  onCreateKey,
}: ApiManagerHeroHeaderProps) {
  const t = useTranslations("apiManager");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-600 via-blue-500 to-violet-600 p-8 shadow-xl">
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">API Key Management</h1>
            <p className="text-base text-blue-50 leading-relaxed max-w-2xl">
              Secure access control for your AI gateway with granular permissions and usage tracking
            </p>
          </div>

          {/* Security Badge */}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <svg
              className="w-5 h-5 text-green-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="text-sm font-semibold text-white">Secure</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onCreateKey}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 active:scale-95 transition-all duration-200 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t("createKey")}
          </button>
          <button
            onClick={onToggleKeyReveal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold text-sm hover:bg-white/20 active:scale-95 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  allowKeyReveal
                    ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                }
              />
            </svg>
            {allowKeyReveal ? "Hide Keys" : "Reveal Keys"}
          </button>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl"></div>
    </div>
  );
}
