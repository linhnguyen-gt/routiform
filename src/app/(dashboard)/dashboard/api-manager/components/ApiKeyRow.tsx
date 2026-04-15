"use client";

import { useTranslations } from "next-intl";

import type { ApiKeyFull, KeyUsageStats } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApiKeyRowProps {
  keyData: ApiKeyFull;
  stats: KeyUsageStats | undefined;
  activeSessions: number;
  allowKeyReveal: boolean;
  copied: string | null;
  onOpenPermissions: (key: ApiKeyFull) => void;
  onDeleteKey: (id: string) => void;
  onCopyExistingKey: (keyId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Single row in the API Key table, showing name, key, permissions badges, usage, and actions. */
export function ApiKeyRow({
  keyData,
  stats,
  activeSessions,
  allowKeyReveal,
  copied,
  onOpenPermissions,
  onDeleteKey,
  onCopyExistingKey,
}: ApiKeyRowProps) {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");

  const isRestricted = Array.isArray(keyData.allowedModels) && keyData.allowedModels.length > 0;
  const hasConnectionRestrictions =
    Array.isArray(keyData.allowedConnections) && keyData.allowedConnections.length > 0;
  const noLogEnabled = keyData.noLog === true;
  const keyIsActive = keyData.isActive !== false;
  const maxSessions = typeof keyData.maxSessions === "number" ? keyData.maxSessions : 0;
  const hasSessionLimit = maxSessions > 0;
  const hasSchedule = keyData.accessSchedule?.enabled === true;

  return (
    <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0 hover:bg-surface/30 transition-colors group">
      {/* Name */}
      <div className="col-span-2 flex items-center gap-2">
        <span
          className={`material-symbols-outlined text-sm ${isRestricted ? "text-amber-500" : "text-emerald-500"}`}
        >
          {isRestricted ? "lock" : "lock_open"}
        </span>
        <span className="text-sm font-medium truncate" title={keyData.name}>
          {keyData.name}
        </span>
      </div>

      {/* Key */}
      <div className="col-span-3 flex items-center gap-1.5">
        <code className="text-sm text-text-muted font-mono truncate">{keyData.key}</code>
        {allowKeyReveal ? (
          <button
            onClick={() => onCopyExistingKey(keyData.id)}
            className="p-1 text-text-muted/60 hover:text-primary transition-colors shrink-0"
            title={tc("copy")}
            aria-label={tc("copy")}
          >
            <span className="material-symbols-outlined text-[14px]">
              {copied === `existing_key_${keyData.id}` ? "check" : "content_copy"}
            </span>
          </button>
        ) : (
          <span
            className="p-1 text-text-muted/40 opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-help"
            title={t("keyOnlyAvailableAtCreation")}
          >
            <span className="material-symbols-outlined text-[14px]">lock</span>
          </span>
        )}
      </div>

      {/* Permissions badges */}
      <div className="col-span-2 flex items-center">
        <div className="flex flex-col items-start gap-1">
          {isRestricted ? (
            <button
              onClick={() => onOpenPermissions(keyData)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">lock</span>
              {t("modelsCount", { count: keyData.allowedModels!.length })}
            </button>
          ) : (
            <button
              onClick={() => onOpenPermissions(keyData)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">lock_open</span>
              {t("allModels")}
            </button>
          )}
          {hasConnectionRestrictions && (
            <button
              onClick={() => onOpenPermissions(keyData)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">cable</span>
              {keyData.allowedConnections!.length} conn
            </button>
          )}
          {noLogEnabled && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-medium">
              <span className="material-symbols-outlined text-[12px]">visibility_off</span>
              No-Log
            </span>
          )}
          {keyData.autoResolve && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[11px] font-medium">
              <span className="material-symbols-outlined text-[12px]">auto_fix_high</span>
              Auto-Resolve
            </span>
          )}
          {hasSessionLimit && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-medium">
              <span className="material-symbols-outlined text-[12px]">group</span>
              Sessions: {activeSessions}/{maxSessions}
            </span>
          )}
          {!keyIsActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-medium">
              <span className="material-symbols-outlined text-[12px]">block</span>
              {t("disabled")}
            </span>
          )}
          {hasSchedule && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-medium">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              {t("scheduleActive")}
            </span>
          )}
        </div>
      </div>

      {/* Usage */}
      <div className="col-span-2 flex flex-col justify-center">
        <span className="text-sm font-medium tabular-nums">
          {stats?.totalRequests ?? 0}{" "}
          <span className="text-text-muted font-normal text-xs">{t("reqs")}</span>
        </span>
        {stats?.lastUsed ? (
          <span className="text-[10px] text-text-muted">
            {t("lastUsedOn", { date: new Date(stats.lastUsed).toLocaleDateString() })}
          </span>
        ) : (
          <span className="text-[10px] text-text-muted italic">{t("neverUsed")}</span>
        )}
      </div>

      {/* Created */}
      <div className="col-span-1 flex items-center text-sm text-text-muted">
        {new Date(keyData.createdAt).toLocaleDateString()}
      </div>

      {/* Actions */}
      <div className="col-span-2 flex items-center justify-end gap-1">
        <button
          onClick={() => onOpenPermissions(keyData)}
          className="p-2 hover:bg-primary/10 rounded text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
          title={t("editPermissions")}
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
        </button>
        <button
          onClick={() => onDeleteKey(keyData.id)}
          className="p-2 hover:bg-red-500/10 rounded text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          title={t("deleteKey")}
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
    </div>
  );
}
