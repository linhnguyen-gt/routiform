"use client";

import { cn } from "@/shared/utils/cn";
import { useTranslations } from "next-intl";

import type { ConnectionRowProps } from "../[id]/types";
import { ProviderDetailConnectionActions } from "./ProviderDetailConnectionActions";
import { ProviderDetailConnectionIdentity } from "./ProviderDetailConnectionIdentity";
import { useProviderDetailConnectionState } from "./useProviderDetailConnectionState";

export function ProviderDetailConnectionRow({
  connection,
  isOAuth,
  isCodex,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggleActive,
  onToggleRateLimit,
  onToggleCodex5h,
  onToggleCodexWeekly,
  onRetest,
  isRetesting,
  onEdit,
  onDelete,
  onReauth,
  onProxy,
  hasProxy,
  proxySource,
  proxyHost,
  onRefreshToken,
  isRefreshing,
  onApplyCodexAuthLocal,
  isApplyingCodexAuthLocal,
  onExportCodexAuthFile,
  isExportingCodexAuthFile,
  showBulkSelect,
  bulkSelected,
  onToggleBulkSelect,
}: ConnectionRowProps) {
  const t = useTranslations("providers");
  const displayName = isOAuth
    ? connection.name || connection.email || connection.displayName || t("oauthAccount")
    : connection.name;
  const applyCodexAuthLabel =
    typeof t.has === "function" && t.has("applyCodexAuthLocal")
      ? t("applyCodexAuthLocal")
      : "Apply auth";
  const exportCodexAuthLabel =
    typeof t.has === "function" && t.has("exportCodexAuthFile")
      ? t("exportCodexAuthFile")
      : "Export auth";

  const {
    codex5hEnabled,
    codexWeeklyEnabled,
    effectiveExpiresAt,
    isCooldown,
    rateLimitEnabled,
    statusPresentation,
    tokenMinsLeft,
  } = useProviderDetailConnectionState(connection, isOAuth, t);

  return (
    <div
      className={cn(
        "group flex flex-col gap-3 px-2 py-4 transition-colors duration-200 sm:px-3",
        "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
        connection.isActive === false && "opacity-60"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <ProviderDetailConnectionIdentity
          bulkSelected={bulkSelected}
          connection={connection}
          displayName={displayName}
          effectiveExpiresAt={effectiveExpiresAt}
          isCooldown={isCooldown}
          isFirst={isFirst}
          isLast={isLast}
          isOAuth={isOAuth}
          onMoveDown={onMoveDown}
          onMoveUp={onMoveUp}
          onToggleBulkSelect={onToggleBulkSelect}
          showBulkSelect={showBulkSelect}
          statusPresentation={statusPresentation}
          t={t}
          tokenMinsLeft={tokenMinsLeft}
        />

        <ProviderDetailConnectionActions
          applyCodexAuthLabel={applyCodexAuthLabel}
          codex5hEnabled={codex5hEnabled}
          codexWeeklyEnabled={codexWeeklyEnabled}
          connection={connection}
          exportCodexAuthLabel={exportCodexAuthLabel}
          hasProxy={hasProxy}
          isApplyingCodexAuthLocal={isApplyingCodexAuthLocal}
          isCodex={isCodex}
          isExportingCodexAuthFile={isExportingCodexAuthFile}
          isRefreshing={isRefreshing}
          isRetesting={isRetesting}
          onApplyCodexAuthLocal={onApplyCodexAuthLocal}
          onDelete={onDelete}
          onEdit={onEdit}
          onExportCodexAuthFile={onExportCodexAuthFile}
          onProxy={onProxy}
          onReauth={onReauth}
          onRefreshToken={onRefreshToken}
          onRetest={onRetest}
          onToggleActive={onToggleActive}
          onToggleCodex5h={onToggleCodex5h}
          onToggleCodexWeekly={onToggleCodexWeekly}
          onToggleRateLimit={onToggleRateLimit}
          proxyHost={proxyHost}
          proxySource={proxySource}
          rateLimitEnabled={rateLimitEnabled}
          t={t}
        />
      </div>

      {connection.lastError && connection.isActive !== false && (
        <p
          className={cn(
            "rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-xs leading-relaxed wrap-break-word",
            statusPresentation.errorTextClass
          )}
          title={connection.lastError.replace(/<[^>]+>/gm, "")}
        >
          {connection.lastError.replace(/<[^>]+>/gm, "")}
        </p>
      )}
    </div>
  );
}
