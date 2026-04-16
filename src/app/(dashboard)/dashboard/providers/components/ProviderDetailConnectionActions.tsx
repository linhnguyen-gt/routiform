"use client";

import { Button, Toggle } from "@/shared/components";

import type { ConnectionRowConnection } from "../[id]/types";
import { ProviderDetailConnectionFooter } from "./ProviderDetailConnectionFooter";

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
    <>
      {/* Actions Container - 2 rows */}
      <div className="flex flex-col gap-2 border border-border/40 bg-bg-subtle/35 p-2 lg:rounded-lg">
        {/* Row 1: Text buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon="refresh"
            loading={isRetesting}
            disabled={connection.isActive === false}
            onClick={onRetest}
            className="h-8 px-2 text-xs"
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
              className="h-8 px-2 text-xs text-amber-500 hover:text-amber-400"
              title="Refresh OAuth token manually"
            >
              Token
            </Button>
          )}
          {isCodex && (
            <div className="flex items-center gap-1.5 border-l border-border/50 pl-2">
              {onApplyCodexAuthLocal && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="download_done"
                  loading={isApplyingCodexAuthLocal}
                  disabled={isApplyingCodexAuthLocal}
                  onClick={onApplyCodexAuthLocal}
                  className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10"
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
                  className="h-8 px-2 text-xs text-sky-600 hover:text-sky-500 hover:bg-sky-500/10"
                  title={exportCodexAuthLabel}
                >
                  {exportCodexAuthLabel}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Row 2: Toggle + Icons + Badges */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Toggle
              size="sm"
              checked={connection.isActive ?? true}
              onChange={onToggleActive}
              title={(connection.isActive ?? true) ? t("disableConnection") : t("enableConnection")}
            />
            <div className="mx-1 h-4 w-px bg-border/50" />
            {onReauth && (
              <button
                type="button"
                onClick={onReauth}
                className="rounded p-1.5 text-amber-600 hover:bg-amber-500/10 hover:text-amber-500"
                title={t("reauthenticateConnection")}
              >
                <span className="material-symbols-outlined text-lg">passkey</span>
              </button>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1.5 text-text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
              title={t("edit")}
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
            <button
              type="button"
              onClick={onProxy}
              className="rounded p-1.5 text-text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
              title={t("proxyConfig")}
            >
              <span className="material-symbols-outlined text-lg">vpn_lock</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1.5 text-red-500 hover:bg-red-500/10"
              title={t("delete")}
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="tabular-nums text-text-muted text-xs">#{connection.priority}</span>
            <button
              type="button"
              onClick={() => onToggleRateLimit(!rateLimitEnabled)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${rateLimitEnabled ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25" : "bg-black/[0.03] text-text-muted/70 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
              title={
                rateLimitEnabled ? t("disableRateLimitProtection") : t("enableRateLimitProtection")
              }
            >
              <span className="material-symbols-outlined text-[14px]">shield</span>
              {rateLimitEnabled ? t("rateLimitProtected") : t("rateLimitUnprotected")}
            </button>
            {isCcCompatible && onToggleCliproxyapiMode && (
              <>
                <span className="text-text-muted/30 select-none">|</span>
                <button
                  type="button"
                  onClick={() => onToggleCliproxyapiMode(!cliproxyapiEnabled)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all cursor-pointer ${
                    cliproxyapiEnabled
                      ? "bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25"
                      : "bg-black/[0.03] text-text-muted/50 hover:text-text-muted hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                  }`}
                  title={
                    cliproxyapiEnabled
                      ? "Using CLIProxyAPI for deeper Claude Code emulation (uTLS, multi-account, device profiles)"
                      : "Enable CLIProxyAPI backend for deeper Claude Code OAuth emulation"
                  }
                >
                  <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                  CPA {cliproxyapiEnabled ? "ON" : "OFF"}
                </button>
              </>
            )}
            {isCodex && (
              <>
                <button
                  type="button"
                  onClick={() => onToggleCodex5h?.(!codex5hEnabled)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${codex5hEnabled ? "bg-blue-500/15 text-blue-500 hover:bg-blue-500/25" : "bg-black/[0.03] text-text-muted/70 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
                  title="Toggle Codex 5h limit policy"
                >
                  <span className="material-symbols-outlined text-[14px]">timer</span>
                  5h {codex5hEnabled ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleCodexWeekly?.(!codexWeeklyEnabled)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${codexWeeklyEnabled ? "bg-violet-500/15 text-violet-500 hover:bg-violet-500/25" : "bg-black/[0.03] text-text-muted/70 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
                  title="Toggle Codex weekly limit policy"
                >
                  <span className="material-symbols-outlined text-[14px]">date_range</span>
                  Weekly {codexWeeklyEnabled ? "ON" : "OFF"}
                </button>
              </>
            )}
            {hasProxy && (
              <span
                className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${proxySource === "global" ? "bg-emerald-500/15 text-emerald-500" : proxySource === "provider" ? "bg-amber-500/15 text-amber-500" : "bg-blue-500/15 text-blue-500"}`}
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
                <span className="material-symbols-outlined shrink-0 text-[14px]">vpn_lock</span>
                <span className="min-w-0 truncate">{proxyHost || t("proxy")}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer now only shows for proxy or other info - badges moved to row 2 */}
      {hasProxy && (
        <ProviderDetailConnectionFooter
          codex5hEnabled={codex5hEnabled}
          codexWeeklyEnabled={codexWeeklyEnabled}
          connection={connection}
          hasProxy={hasProxy}
          isCodex={isCodex}
          onToggleCodex5h={onToggleCodex5h}
          onToggleCodexWeekly={onToggleCodexWeekly}
          onToggleRateLimit={onToggleRateLimit}
          proxyHost={proxyHost}
          proxySource={proxySource}
          rateLimitEnabled={rateLimitEnabled}
          t={t}
        />
      )}
    </>
  );
}
