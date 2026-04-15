"use client";

import { cn } from "@/shared/utils/cn";
import type { PassthroughModelRowProps } from "../[id]/types";
import { ModelCompatPopover } from "./ModelCompatPopover";

export function PassthroughModelRow({
  modelId,
  fullModel,
  copied,
  onCopy,
  onDeleteAlias,
  t,
  showDeveloperToggle = true,
  effectiveModelNormalize,
  effectiveModelPreserveDeveloper,
  getUpstreamHeadersRecord,
  saveModelCompatFlags,
  compatDisabled,
  testStatus,
  onTest,
  isTesting,
}: PassthroughModelRowProps) {
  const borderColor =
    testStatus === "ok"
      ? "border-green-500/40"
      : testStatus === "error"
        ? "border-red-500/40"
        : "border-border";
  const statusIcon =
    testStatus === "ok" ? "check_circle" : testStatus === "error" ? "cancel" : "smart_toy";
  const statusColor =
    testStatus === "ok" ? "#22c55e" : testStatus === "error" ? "#ef4444" : undefined;

  return (
    <div
      className={cn(
        "group flex min-w-0 flex-col gap-2 rounded-xl border bg-surface/50 p-3 shadow-sm transition-colors hover:bg-sidebar/40",
        borderColor
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span
            className="material-symbols-outlined mt-0.5 shrink-0 text-lg"
            style={statusColor ? { color: statusColor } : { color: "var(--color-text-muted)" }}
          >
            {statusIcon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-text-main">{modelId}</p>
            <code className="mt-1 block break-all rounded-md bg-sidebar/80 px-2 py-1.5 font-mono text-[11px] leading-snug text-text-muted sm:text-xs">
              {fullModel}
            </code>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
          <ModelCompatPopover
            t={t}
            effectiveModelNormalize={(p) => effectiveModelNormalize(modelId, p)}
            effectiveModelPreserveDeveloper={(p) => effectiveModelPreserveDeveloper(modelId, p)}
            getUpstreamHeadersRecord={getUpstreamHeadersRecord}
            onCompatPatch={(protocol, payload) =>
              saveModelCompatFlags(modelId, { compatByProtocol: { [protocol]: payload } })
            }
            showDeveloperToggle={showDeveloperToggle}
            disabled={compatDisabled}
          />
          <button
            type="button"
            onClick={onDeleteAlias}
            className="rounded-md p-1.5 text-red-500 hover:bg-red-500/10"
            title={t("removeModel")}
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 border-t border-border/50 pt-2">
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={isTesting}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-sidebar hover:text-primary disabled:opacity-50",
              isTesting && "text-primary"
            )}
            title={isTesting ? t("testingModel") : t("testModel")}
            aria-label={isTesting ? t("testingModel") : t("testModel")}
          >
            <span
              className={`material-symbols-outlined text-base ${isTesting ? "animate-spin" : ""}`}
            >
              {isTesting ? "progress_activity" : "science"}
            </span>
            <span className="hidden sm:inline">
              {isTesting ? t("testingModel") : t("testModel")}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onCopy(fullModel, `model-${modelId}`)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-sidebar hover:text-primary"
          title={t("copyModel")}
        >
          <span className="material-symbols-outlined text-base">
            {copied === `model-${modelId}` ? "check" : "content_copy"}
          </span>
          <span className="hidden sm:inline">{t("copyModel")}</span>
        </button>
      </div>
    </div>
  );
}
