"use client";

import { Badge } from "@/shared/components";

import type { ConnectionRowConnection } from "../[id]/types";
import { ProviderDetailCooldownTimer } from "./ProviderDetailCooldownTimer";

type StatusPresentation = {
  statusVariant: string;
  statusLabel: string;
  errorBadge: { labelKey: string; variant: string } | null;
};

type Translator = (key: string, values?: unknown) => string;

type Props = {
  bulkSelected?: boolean;
  connection: ConnectionRowConnection;
  displayName?: string;
  effectiveExpiresAt?: string;
  isCooldown: boolean;
  isFirst: boolean;
  isLast: boolean;
  isOAuth: boolean;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onToggleBulkSelect?: () => void;
  showBulkSelect?: boolean;
  statusPresentation: StatusPresentation;
  t: Translator;
  tokenMinsLeft: number | null;
};

export function ProviderDetailConnectionIdentity({
  bulkSelected,
  connection,
  displayName,
  effectiveExpiresAt,
  isCooldown,
  isFirst,
  isLast,
  isOAuth,
  onMoveDown,
  onMoveUp,
  onToggleBulkSelect,
  showBulkSelect,
  statusPresentation,
  t,
  tokenMinsLeft,
}: Props) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      {showBulkSelect && onToggleBulkSelect && (
        <input
          type="checkbox"
          checked={!!bulkSelected}
          onChange={onToggleBulkSelect}
          className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded border-border"
          aria-label={t("selectConnection")}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className={`rounded p-0.5 ${isFirst ? "cursor-not-allowed text-text-muted/20" : "text-text-muted/50 hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"}`}
        >
          <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className={`rounded p-0.5 ${isLast ? "cursor-not-allowed text-text-muted/20" : "text-text-muted/50 hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"}`}
        >
          <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
        </button>
      </div>
      <span className="material-symbols-outlined mt-1 shrink-0 text-sm text-text-muted/60">
        {isOAuth ? "lock" : "key"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug text-text-main">{displayName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={statusPresentation.statusVariant as never} size="sm" dot>
            {statusPresentation.statusLabel}
          </Badge>
          {tokenMinsLeft !== null &&
            (tokenMinsLeft < 0 ? (
              <span
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium bg-red-500/10 text-red-600"
                title={`Token expired: ${effectiveExpiresAt}`}
              >
                <span className="material-symbols-outlined text-[11px]">error</span>
                expired
              </span>
            ) : tokenMinsLeft < 30 ? (
              <span
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-600"
                title={`Token expires in ${tokenMinsLeft}m`}
              >
                <span className="material-symbols-outlined text-[11px]">warning</span>
                {`~${tokenMinsLeft}m`}
              </span>
            ) : null)}
          {isCooldown && connection.isActive !== false && (
            <ProviderDetailCooldownTimer until={connection.rateLimitedUntil || ""} />
          )}
          {statusPresentation.errorBadge && connection.isActive !== false && (
            <Badge variant={statusPresentation.errorBadge.variant as never} size="sm">
              {t(statusPresentation.errorBadge.labelKey)}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
