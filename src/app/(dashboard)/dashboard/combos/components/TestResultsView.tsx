"use client";

import { useTranslations } from "next-intl";
import { getI18nOrFallback } from "./combo-utils";

interface TestResultsViewProps {
  results: any;
}

export function TestResultsView({ results }: TestResultsViewProps) {
  const t = useTranslations("combos");

  if (results.error) {
    return (
      <div className="flex items-center gap-2 text-red-500 text-sm">
        <span className="material-symbols-outlined text-[18px]">error</span>
        {typeof results.error === "string" ? results.error : JSON.stringify(results.error)}
      </div>
    );
  }

  const softenFailedRows =
    Boolean(results.resolvedBy) &&
    Array.isArray(results.results) &&
    results.results.some((r: any) => r.status === "error");

  return (
    <div className="flex flex-col gap-2">
      {results.resolvedBy && (
        <div className="flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-emerald-500 text-[18px]">
            check_circle
          </span>
          <span>
            Resolved by:{" "}
            <code className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
              {results.resolvedBy}
            </code>
          </span>
        </div>
      )}
      {softenFailedRows ? (
        <p className="text-xs text-amber-800 dark:text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5 leading-snug">
          {getI18nOrFallback(
            t,
            "comboTestPartialSuccess",
            "Some models failed this smoke test, but another model resolved the combo — routing still works."
          )}
        </p>
      ) : null}
      {results.results?.map((r: any, i: number) => {
        const rowFailed = r.status !== "ok" && r.status !== "skipped";
        const warnRow = softenFailedRows && rowFailed;
        return (
          <div
            key={i}
            className="flex flex-col gap-0.5 text-xs px-2 py-1.5 rounded bg-black/[0.02] dark:bg-white/[0.02]"
          >
            <div title={r.error || undefined} className="flex items-center gap-2 min-w-0">
              <span
                className={`material-symbols-outlined text-[14px] shrink-0 ${
                  r.status === "ok"
                    ? "text-emerald-500"
                    : r.status === "skipped"
                      ? "text-text-muted"
                      : warnRow
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-500"
                }`}
              >
                {r.status === "ok"
                  ? "check_circle"
                  : r.status === "skipped"
                    ? "skip_next"
                    : warnRow
                      ? "warning"
                      : "error"}
              </span>
              <code className="font-mono flex-1 truncate min-w-0">{r.model}</code>
              {r.latencyMs !== undefined && (
                <span className="text-text-muted shrink-0">{r.latencyMs}ms</span>
              )}
              <span
                className={`text-[10px] uppercase font-medium shrink-0 ${
                  r.status === "ok"
                    ? "text-emerald-500"
                    : r.status === "skipped"
                      ? "text-text-muted"
                      : warnRow
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-500"
                }`}
              >
                {r.status}
              </span>
            </div>
            {r.status !== "ok" && typeof r.error === "string" && r.error.trim() ? (
              <p
                className={`text-[10px] pl-6 leading-snug break-words max-h-24 overflow-y-auto ${
                  warnRow ? "text-amber-800/95 dark:text-amber-200/85" : "text-red-500/90"
                }`}
              >
                {r.statusCode != null ? `[${r.statusCode}] ` : ""}
                {r.error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
