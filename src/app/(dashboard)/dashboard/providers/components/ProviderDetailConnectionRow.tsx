"use client";

import { cn } from "@/shared/utils/cn";
import { useTranslations } from "next-intl";

import type { ConnectionRowProps } from "../[id]/types";
import { ProviderDetailConnectionIdentity } from "./ProviderDetailConnectionIdentity";
import { ProviderDetailConnectionActions } from "./ProviderDetailConnectionActions";
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
  isCcCompatible,
  cliproxyapiEnabled,
  onToggleCliproxyapiMode,
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
  const oauthIdentifier =
    (connection.providerSpecificData?.githubLogin as string | undefined) ||
    (connection.providerSpecificData?.firstName && connection.providerSpecificData?.lastName
      ? `${connection.providerSpecificData.firstName} ${connection.providerSpecificData.lastName}`
      : undefined);

  const displayName = isOAuth
    ? connection.name ||
      oauthIdentifier ||
      connection.email ||
      connection.displayName ||
      t("oauthAccount")
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
        "group grid grid-cols-1 gap-2 px-2 py-3 transition-colors duration-200 lg:grid-cols-[1fr_auto] lg:gap-4 lg:px-3 lg:py-3",
        "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
        connection.isActive === false && "opacity-50"
      )}
    >
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
        isCcCompatible={isCcCompatible}
        cliproxyapiEnabled={cliproxyapiEnabled}
        onToggleCliproxyapiMode={onToggleCliproxyapiMode}
        onToggleRateLimit={onToggleRateLimit}
        proxyHost={proxyHost}
        proxySource={proxySource}
        rateLimitEnabled={rateLimitEnabled}
        t={t}
      />

      {connection.lastError && connection.isActive !== false && (
        <p
          className={cn(
            "col-span-full rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-xs leading-relaxed",
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
