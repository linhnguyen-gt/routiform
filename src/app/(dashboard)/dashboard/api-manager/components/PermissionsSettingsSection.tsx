"use client";

import { Input } from "@/shared/components";
import { useTranslations } from "next-intl";

import type { PermissionsState } from "../hooks/use-permissions-state-types";
import { PermissionsScheduleSection } from "./PermissionsScheduleSection";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionsSettingsSectionProps {
  state: PermissionsState;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Settings rows inside PermissionsModal: key active, max sessions, schedule, no-log, auto-resolve. */
export function PermissionsSettingsSection({ state }: PermissionsSettingsSectionProps) {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");

  return (
    <>
      {/* Key Active Toggle */}
      <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-surface/40">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-main">{t("keyActive")}</p>
          <p className="text-xs text-text-muted">{t("keyActiveDesc")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.keyIsActive}
          onClick={() => state.setKeyIsActive((prev: boolean) => !prev)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            state.keyIsActive
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
              : "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {state.keyIsActive ? "check_circle" : "block"}
          </span>
          {state.keyIsActive ? tc("enabled") : tc("disabled")}
        </button>
      </div>

      {/* Max Sessions Limit */}
      <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-surface/40">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-main">Max Active Sessions</p>
          <p className="text-xs text-text-muted">
            0 = unlimited. Return 429 when this key exceeds concurrent sticky sessions.
          </p>
        </div>
        <div className="w-32">
          <Input
            type="number"
            min={0}
            step={1}
            value={String(state.maxSessions)}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value || "0", 10);
              state.setMaxSessions(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
            }}
          />
        </div>
      </div>

      {/* Access Schedule */}
      <PermissionsScheduleSection
        scheduleEnabled={state.scheduleEnabled}
        onToggleSchedule={state.setScheduleEnabled}
        scheduleFrom={state.scheduleFrom}
        onFromChange={state.setScheduleFrom}
        scheduleUntil={state.scheduleUntil}
        onUntilChange={state.setScheduleUntil}
        scheduleDays={state.scheduleDays}
        onDaysChange={state.setScheduleDays}
        scheduleTz={state.scheduleTz}
        onTzChange={state.setScheduleTz}
      />

      {/* Privacy Toggle */}
      <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-surface/40">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-main">No-Log Payload Privacy</p>
          <p className="text-xs text-text-muted">
            Disable request/response payload persistence for this API key.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.noLogEnabled}
          onClick={() => state.setNoLogEnabled((prev: boolean) => !prev)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            state.noLogEnabled
              ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30"
              : "bg-black/5 dark:bg-white/5 text-text-muted border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {state.noLogEnabled ? "visibility_off" : "visibility"}
          </span>
          {state.noLogEnabled ? tc("enabled") : tc("disabled")}
        </button>
      </div>

      {/* Auto-Resolve Toggle */}
      <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-surface/40">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-main">{t("autoResolve")}</p>
          <p className="text-xs text-text-muted">{t("autoResolveDesc")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.autoResolveEnabled}
          onClick={() => state.setAutoResolveEnabled((prev: boolean) => !prev)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            state.autoResolveEnabled
              ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
              : "bg-black/5 dark:bg-white/5 text-text-muted border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {state.autoResolveEnabled ? "auto_fix_high" : "auto_fix_normal"}
          </span>
          {state.autoResolveEnabled ? tc("enabled") : tc("disabled")}
        </button>
      </div>
    </>
  );
}
