"use client";

import { Button, Toggle } from "@/shared/components";
import { useTranslations } from "next-intl";

import type { ConnectionRowConnection } from "../[id]/types";

type Translator = (key: string, values?: unknown) => string;

type Props = {
  applyCodexAuthLabel: string;
  codex5hEnabled: boolean;
  codexWeeklyEnabled: boolean;
  connection: ConnectionRowConnection;
  exportCodexAuthLabel: string;
  hasProxy?: boolean;
  isApplyingCodexAuthLocal?: boolean;
  isCodex?: boolean;
  isExportingCodexAuthFile?: boolean;
  isRefreshing?: boolean;
  isRetesting?: boolean;
  onApplyCodexAuthLocal?: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onExportCodexAuthFile?: () => void;
  onProxy?: () => void;
  onReauth?: () => void;
  onRefreshToken?: () => void;
  onRetest: () => void;
  onToggleActive: (isActive?: boolean) => void | Promise<void>;
  onToggleCodex5h?: (enabled?: boolean) => void;
  onToggleCodexWeekly?: (enabled?: boolean) => void;
  isCcCompatible?: boolean;
  cliproxyapiEnabled?: boolean;
  onToggleCliproxyapiMode?: (enabled?: boolean) => void;
  onToggleRateLimit: (enabled?: boolean) => void;
  proxyHost?: string;
  proxySource?: string;
  rateLimitEnabled: boolean;
  t: Translator;
};

export function ProviderDetailConnectionActions(props: Props) {
  const ti = useTranslations("providers");
  const {
    applyCodexAuthLabel,
    codex5hEnabled,
    codexWeeklyEnabled,
    connection,
    exportCodexAuthLabel,
    hasProxy,
    isApplyingCodexAuthLocal,
    isCodex,
    isExportingCodexAuthFile,
    isRefreshing,
    isRetesting,
    onApplyCodexAuthLocal,
    onDelete,
    onEdit,
    onExportCodexAuthFile,
    onProxy,
    onReauth,
    onRefreshToken,
    onRetest,
    onToggleActive,
    onToggleCodex5h,
    onToggleCodexWeekly,
    isCcCompatible,
    cliproxyapiEnabled,
    onToggleCliproxyapiMode,
    onToggleRateLimit,
    proxyHost,
    proxySource,
    rateLimitEnabled,
    t,
  } = props;

  return (
    <div className="flex flex-col gap-2 lg:min-w-[280px] lg:shrink-0 lg:self-start">
      {/* Row 1: Action buttons */}
      <div className="flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          icon="refresh"
          loading={isRetesting}
          disabled={connection.isActive === false}
          onClick={onRetest}
          className="h-7 px-2 text-[11px]"
          title={t("retestAuthentication")}
        >
          {t("retest")}
        </Button>
        {onRefreshToken && (
          <Button
            size="sm"
            variant="ghost"
            icon="token"
            loading={isRefreshing}
            disabled={connection.isActive === false || isRefreshing}
            onClick={onRefreshToken}
            className="h-7 px-2 text-[11px] text-amber-500"
            title="Refresh OAuth token manually"
          >
            Token
          </Button>
        )}
        {isCodex && (
          <span className="flex items-center gap-1 border-l border-border/40 pl-1.5">
            {onApplyCodexAuthLocal && (
              <Button
                size="sm"
                variant="ghost"
                icon="download_done"
                loading={isApplyingCodexAuthLocal}
                disabled={isApplyingCodexAuthLocal}
                onClick={onApplyCodexAuthLocal}
                className="h-7 px-2 text-[11px] text-emerald-600"
                title={applyCodexAuthLabel}
              >
                {applyCodexAuthLabel}
              </Button>
            )}
            {onExportCodexAuthFile && (
              <Button
                size="sm"
                variant="ghost"
                icon="download"
                loading={isExportingCodexAuthFile}
                disabled={isExportingCodexAuthFile}
                onClick={onExportCodexAuthFile}
                className="h-7 px-2 text-[11px] text-sky-600"
                title={exportCodexAuthLabel}
              >
                {exportCodexAuthLabel}
              </Button>
            )}
          </span>
        )}
        <span className="mx-1 h-4 w-px bg-border/30" />
        {onReauth && (
          <button
            type="button"
            onClick={onReauth}
            className="rounded p-1 text-amber-600 hover:bg-amber-500/10 hover:text-amber-500"
            title={t("reauthenticateConnection")}
          >
            <span className="material-symbols-outlined text-[18px]">passkey</span>
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1 text-text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
          title={t("edit")}
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
        </button>
        {onProxy && (
          <button
            type="button"
            onClick={onProxy}
            className="rounded p-1 text-text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
            title={t("proxyConfig")}
          >
            <span className="material-symbols-outlined text-[18px]">vpn_lock</span>
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-red-500/70 hover:bg-red-500/10 hover:text-red-500"
          title={t("delete")}
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>

      {/* Row 2: Toggle + status pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Toggle
          size="sm"
          checked={connection.isActive ?? true}
          onChange={onToggleActive}
          title={(connection.isActive ?? true) ? t("disableConnection") : t("enableConnection")}
        />
        <span className="text-xs tabular-nums text-text-muted/60">#{connection.priority}</span>
        <button
          type="button"
          onClick={() => onToggleRateLimit(!rateLimitEnabled)}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${rateLimitEnabled ? "bg-emerald-500/10 text-emerald-600" : "bg-black/[0.03] text-text-muted/50 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
          title={
            rateLimitEnabled ? t("disableRateLimitProtection") : t("enableRateLimitProtection")
          }
        >
          <span className="material-symbols-outlined text-[13px]">shield</span>
          {rateLimitEnabled ? t("rateLimitProtected") : t("rateLimitUnprotected")}
        </button>
        {isCcCompatible && onToggleCliproxyapiMode && (
          <button
            type="button"
            onClick={() => onToggleCliproxyapiMode(!cliproxyapiEnabled)}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${cliproxyapiEnabled ? "bg-indigo-500/10 text-indigo-600" : "bg-black/[0.03] text-text-muted/50 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
            title={cliproxyapiEnabled ? ti("cpa.tooltipEnabled") : ti("cpa.tooltipDisabled")}
          >
            <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
            {cliproxyapiEnabled ? ti("cpa.labelOn") : ti("cpa.labelOff")}
          </button>
        )}
        {isCodex && (
          <>
            <button
              type="button"
              onClick={() => onToggleCodex5h?.(!codex5hEnabled)}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${codex5hEnabled ? "bg-blue-500/10 text-blue-600" : "bg-black/[0.03] text-text-muted/50 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
              title="Toggle Codex 5h limit policy"
            >
              <span className="material-symbols-outlined text-[13px]">timer</span>
              5h {codex5hEnabled ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={() => onToggleCodexWeekly?.(!codexWeeklyEnabled)}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${codexWeeklyEnabled ? "bg-violet-500/10 text-violet-600" : "bg-black/[0.03] text-text-muted/50 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
              title="Toggle Codex weekly limit policy"
            >
              <span className="material-symbols-outlined text-[13px]">date_range</span>
              Weekly {codexWeeklyEnabled ? "ON" : "OFF"}
            </button>
          </>
        )}
        {hasProxy && (
          <span
            className={`inline-flex max-w-[160px] items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${proxySource === "global" ? "bg-emerald-500/10 text-emerald-600" : proxySource === "provider" ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"}`}
            title={t("proxyConfiguredBySource", {
              source:
                proxySource === "global"
                  ? t("proxySourceGlobal")
                  : proxySource === "provider"
                    ? t("proxySourceProvider")
                    : t("proxySourceKey"),
              host: proxyHost || t("configured"),
            })}
          >
            <span className="material-symbols-outlined shrink-0 text-[13px]">vpn_lock</span>
            <span className="truncate">{proxyHost || t("proxy")}</span>
          </span>
        )}
      </div>
    </div>
  );
}
