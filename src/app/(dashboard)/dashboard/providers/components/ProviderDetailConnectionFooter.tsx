"use client";

import type { ConnectionRowConnection } from "../[id]/types";

type Translator = (key: string, values?: unknown) => string;

type Props = {
  codex5hEnabled: boolean;
  codexWeeklyEnabled: boolean;
  connection: ConnectionRowConnection;
  hasProxy?: boolean;
  isCodex?: boolean;
  onToggleCodex5h?: (enabled?: boolean) => void;
  onToggleCodexWeekly?: (enabled?: boolean) => void;
  onToggleRateLimit: (enabled?: boolean) => void;
  proxyHost?: string;
  proxySource?: string;
  rateLimitEnabled: boolean;
  t: Translator;
};

export function ProviderDetailConnectionFooter({
  codex5hEnabled,
  codexWeeklyEnabled,
  connection,
  hasProxy,
  isCodex,
  onToggleCodex5h,
  onToggleCodexWeekly,
  onToggleRateLimit,
  proxyHost,
  proxySource,
  rateLimitEnabled,
  t,
}: Props) {
  const proxyColorClass =
    proxySource === "global"
      ? "bg-emerald-500/15 text-emerald-500"
      : proxySource === "provider"
        ? "bg-amber-500/15 text-amber-500"
        : "bg-blue-500/15 text-blue-500";
  const proxyLabel =
    proxySource === "global"
      ? t("proxySourceGlobal")
      : proxySource === "provider"
        ? t("proxySourceProvider")
        : t("proxySourceKey");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/40 pt-3 text-xs">
      {/* Priority */}
      <span className="tabular-nums text-text-muted">
        #{connection.priority}
        {connection.globalPriority
          ? ` · ${t("autoPriority", { priority: connection.globalPriority })}`
          : ""}
      </span>

      {/* Status Badges Group */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Rate Limit */}
        <button
          type="button"
          onClick={() => onToggleRateLimit(!rateLimitEnabled)}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${rateLimitEnabled ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25" : "bg-black/[0.03] text-text-muted/70 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
          title={
            rateLimitEnabled ? t("disableRateLimitProtection") : t("enableRateLimitProtection")
          }
        >
          <span className="material-symbols-outlined text-[14px]">shield</span>
          {rateLimitEnabled ? t("rateLimitProtected") : t("rateLimitUnprotected")}
        </button>

        {/* Codex-specific Badges */}
        {isCodex && (
          <>
            <button
              type="button"
              onClick={() => onToggleCodex5h?.(!codex5hEnabled)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${codex5hEnabled ? "bg-blue-500/15 text-blue-500 hover:bg-blue-500/25" : "bg-black/[0.03] text-text-muted/70 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
              title="Toggle Codex 5h limit policy"
            >
              <span className="material-symbols-outlined text-[14px]">timer</span>
              5h {codex5hEnabled ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={() => onToggleCodexWeekly?.(!codexWeeklyEnabled)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${codexWeeklyEnabled ? "bg-violet-500/15 text-violet-500 hover:bg-violet-500/25" : "bg-black/[0.03] text-text-muted/70 hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"}`}
              title="Toggle Codex weekly limit policy"
            >
              <span className="material-symbols-outlined text-[14px]">date_range</span>
              Weekly {codexWeeklyEnabled ? "ON" : "OFF"}
            </button>
          </>
        )}

        {/* Proxy */}
        {hasProxy && (
          <span
            className={`inline-flex max-w-full items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${proxyColorClass}`}
            title={t("proxyConfiguredBySource", {
              source: proxyLabel,
              host: proxyHost || t("configured"),
            })}
          >
            <span className="material-symbols-outlined shrink-0 text-[14px]">vpn_lock</span>
            <span className="min-w-0 truncate">{proxyHost || t("proxy")}</span>
          </span>
        )}
      </div>
    </div>
  );
}
