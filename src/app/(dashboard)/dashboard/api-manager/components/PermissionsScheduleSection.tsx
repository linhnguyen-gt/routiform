"use client";

import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionsScheduleSectionProps {
  scheduleEnabled: boolean;
  onToggleSchedule: (v: boolean | ((prev: boolean) => boolean)) => void;
  scheduleFrom: string;
  onFromChange: (v: string) => void;
  scheduleUntil: string;
  onUntilChange: (v: string) => void;
  scheduleDays: number[];
  onDaysChange: (v: number[] | ((prev: number[]) => number[])) => void;
  scheduleTz: string;
  onTzChange: (v: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionsScheduleSection({
  scheduleEnabled,
  onToggleSchedule,
  scheduleFrom,
  onFromChange,
  scheduleUntil,
  onUntilChange,
  scheduleDays,
  onDaysChange,
  scheduleTz,
  onTzChange,
}: PermissionsScheduleSectionProps) {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-surface/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-main">{t("accessSchedule")}</p>
          <p className="text-xs text-text-muted">{t("accessScheduleDesc")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={scheduleEnabled}
          onClick={() => onToggleSchedule((prev: boolean) => !prev)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 ${
            scheduleEnabled
              ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30"
              : "bg-black/5 dark:bg-white/5 text-text-muted border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          {scheduleEnabled ? tc("enabled") : tc("disabled")}
        </button>
      </div>
      {scheduleEnabled && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-muted mb-1 block">{t("scheduleFrom")}</label>
              <input
                type="time"
                value={scheduleFrom}
                onChange={(e) => onFromChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-text-main"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">{t("scheduleUntil")}</label>
              <input
                type="time"
                value={scheduleUntil}
                onChange={(e) => onUntilChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-text-main"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">{t("scheduleDays")}</label>
            <div className="flex gap-1 flex-wrap">
              {(
                [
                  [0, t("daySun")],
                  [1, t("dayMon")],
                  [2, t("dayTue")],
                  [3, t("dayWed")],
                  [4, t("dayThu")],
                  [5, t("dayFri")],
                  [6, t("daySat")],
                ] as [number, string][]
              ).map(([dayIdx, label]) => {
                const selected = scheduleDays.includes(dayIdx);
                return (
                  <button
                    key={dayIdx}
                    type="button"
                    onClick={() =>
                      onDaysChange((prev: number[]) =>
                        prev.includes(dayIdx)
                          ? prev.filter((d) => d !== dayIdx)
                          : [...prev, dayIdx].sort((a, b) => a - b)
                      )
                    }
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-all ${
                      selected
                        ? "bg-primary text-white"
                        : "bg-surface border border-border text-text-muted hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">{t("scheduleTimezone")}</label>
            <input
              type="text"
              value={scheduleTz}
              onChange={(e) => onTzChange(e.target.value)}
              placeholder="America/Sao_Paulo"
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-text-main font-mono"
            />
            <p className="text-[10px] text-text-muted mt-1">{t("scheduleTimezoneHint")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
