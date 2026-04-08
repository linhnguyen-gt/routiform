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
    <div className="flex min-w-0 flex-1 items-start gap-3">
      {showBulkSelect && onToggleBulkSelect && (
        <input
          type="checkbox"
          checked={!!bulkSelected}
          onChange={onToggleBulkSelect}
          className="mt-1 h-4 w-4 shrink-0 rounded border-border"
          aria-label={t("selectConnection")}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className={`rounded p-0.5 ${isFirst ? "cursor-not-allowed text-text-muted/30" : "text-text-muted hover:bg-sidebar hover:text-primary"}`}
        >
          <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className={`rounded p-0.5 ${isLast ? "cursor-not-allowed text-text-muted/30" : "text-text-muted hover:bg-sidebar hover:text-primary"}`}
        >
          <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
        </button>
      </div>
      <span className="material-symbols-outlined mt-0.5 shrink-0 text-base text-text-muted">
        {isOAuth ? "lock" : "key"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-text-main">{displayName}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={statusPresentation.statusVariant as never} size="sm" dot>
            {statusPresentation.statusLabel}
          </Badge>
          {tokenMinsLeft !== null &&
            (tokenMinsLeft < 0 ? (
              <span
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium bg-red-500/15 text-red-500"
                title={`Token expired: ${effectiveExpiresAt}`}
              >
                <span className="material-symbols-outlined text-[11px]">error</span>
                expired
              </span>
            ) : tokenMinsLeft < 30 ? (
              <span
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-500"
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
