"use client";

import { useTranslations } from "next-intl";
import { getI18nOrFallback } from "./combo-utils";

interface ReadinessCheck {
  id: string;
  ok: boolean;
  label: string;
}

interface ComboReadinessPanelProps {
  checks: ReadinessCheck[];
  blockers: string[];
}

export function ComboReadinessPanel({ checks, blockers }: ComboReadinessPanelProps) {
  const t = useTranslations("combos");
  const hasBlockers = blockers.length > 0;

  return (
    <div
      data-testid="combo-readiness-panel"
      className={`rounded-lg border px-2.5 py-2 ${
        hasBlockers
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-emerald-500/20 bg-emerald-500/[0.04]"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`material-symbols-outlined text-[14px] ${
            hasBlockers
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {hasBlockers ? "rule" : "check_circle"}
        </span>
        <p className="text-[11px] font-medium text-text-main">
          {getI18nOrFallback(t, "readinessTitle", "Ready to save?")}
        </p>
      </div>

      <p className="text-[10px] text-text-muted mt-0.5">
        {getI18nOrFallback(
          t,
          "readinessDescription",
          "Review the checklist before creating or updating this combo."
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-2">
        {checks.map((check) => (
          <div
            key={check.id}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 bg-black/[0.02] dark:bg-white/[0.02]"
          >
            <span
              className={`material-symbols-outlined text-[12px] ${
                check.ok ? "text-emerald-500" : "text-amber-500"
              }`}
            >
              {check.ok ? "task_alt" : "pending"}
            </span>
            <span className="text-[10px] text-text-main">{check.label}</span>
          </div>
        ))}
      </div>

      {hasBlockers && (
        <div
          data-testid="combo-save-blockers"
          className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5"
        >
          <p className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
            {getI18nOrFallback(
              t,
              "saveBlockedTitle",
              "Save is blocked until the following items are fixed:"
            )}
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            {blockers.map((blocker, index) => (
              <p
                key={`${blocker}-${index}`}
                className="text-[10px] text-amber-700 dark:text-amber-300"
              >
                • {blocker}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
