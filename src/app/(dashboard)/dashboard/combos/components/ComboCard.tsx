"use client";

import { Card, Toggle } from "@/shared/components";
import Tooltip from "@/shared/components/Tooltip";
import { useTranslations } from "next-intl";
import { getProviderDisplayName, normalizeModelEntry } from "./combo-data";
import { getStrategyBadgeClass, getStrategyDescription, getStrategyLabel } from "./combo-utils";
import type { ComboMetrics, ComboModelEntry, ComboRecord, ProviderNode } from "./combo-types";

interface ComboCardProps {
  combo: ComboRecord;
  metrics?: ComboMetrics;
  providerNodes: ProviderNode[];
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTest: () => void;
  testing: boolean;
  onProxy: () => void;
  hasProxy: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function ComboCard({
  combo,
  metrics,
  copied,
  onCopy,
  onEdit,
  onDelete,
  onDuplicate,
  onTest,
  testing,
  onProxy,
  hasProxy,
  onToggle,
  providerNodes,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: ComboCardProps) {
  const strategy = combo.strategy || "priority";
  const models = combo.models || [];
  const isDisabled = combo.isActive === false;
  const t = useTranslations("combos");
  const tc = useTranslations("common");
  const strategyDescription = getStrategyDescription(t, strategy);

  const formatModelDisplay = (modelValue: string) =>
    getProviderDisplayName(modelValue, providerNodes);

  return (
    <Card padding="sm" className={`group ${isDisabled ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[18px]">layers</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <code className="text-sm font-medium font-mono truncate">{combo.name}</code>
              <Tooltip content={strategyDescription}>
                <span
                  className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full ${getStrategyBadgeClass(
                    strategy
                  )}`}
                >
                  {getStrategyLabel(t, strategy)}
                </span>
              </Tooltip>
              {hasProxy && (
                <span
                  className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-0.5"
                  title={t("proxyConfigured")}
                >
                  <span className="material-symbols-outlined text-[11px]">vpn_lock</span>
                  proxy
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(combo.name, `combo-${combo.id}`);
                }}
                className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                title={t("copyComboName")}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copied === `combo-${combo.id}` ? "check" : "content_copy"}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {models.length === 0 ? (
                <span className="text-xs text-text-muted italic">{t("noModels")}</span>
              ) : (
                models.slice(0, 3).map((entry: string | ComboModelEntry, index: number) => {
                  const { model, weight } = normalizeModelEntry(entry);
                  return (
                    <code
                      key={index}
                      className="text-[10px] font-mono bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-text-muted"
                    >
                      {formatModelDisplay(model)}
                      {strategy === "weighted" && weight > 0 ? ` (${weight}%)` : ""}
                    </code>
                  );
                })
              )}
              {models.length > 3 && (
                <span className="text-[10px] text-text-muted">
                  {t("more", { count: models.length - 3 })}
                </span>
              )}
            </div>

            {metrics && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-text-muted">
                  <span className="text-emerald-500">{metrics.totalSuccesses}</span>/
                  {metrics.totalRequests} {t("reqs")}
                </span>
                <span className="text-[10px] text-text-muted">
                  {metrics.successRate}% {t("success")}
                </span>
                <span className="text-[10px] text-text-muted">~{metrics.avgLatencyMs}ms</span>
                {metrics.fallbackRate > 0 && (
                  <span className="text-[10px] text-amber-500">
                    {metrics.fallbackRate}% fallback
                  </span>
                )}
                {metrics.lastRoutingFailure?.httpStatus != null && (
                  <span
                    className="text-[10px] text-rose-500/90"
                    title={
                      metrics.lastRoutingFailure.modelStr
                        ? `${metrics.lastRoutingFailure.httpStatus} ${metrics.lastRoutingFailure.modelStr}`
                        : String(metrics.lastRoutingFailure.httpStatus)
                    }
                  >
                    last err {metrics.lastRoutingFailure.httpStatus}
                    {metrics.lastRoutingFailure.modelStr
                      ? ` · ${formatModelDisplay(metrics.lastRoutingFailure.modelStr)}`
                      : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <Toggle
            size="sm"
            checked={!isDisabled}
            onChange={onToggle}
            title={isDisabled ? t("enableCombo") : t("disableCombo")}
          />
          <div className="flex items-center gap-1 transition-opacity">
            <button
              onClick={onTest}
              disabled={testing}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-emerald-500 transition-colors"
              title={t("testCombo")}
            >
              <span
                className={`material-symbols-outlined text-[16px] ${testing ? "animate-spin" : ""}`}
              >
                {testing ? "progress_activity" : "play_arrow"}
              </span>
            </button>
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t("moveUp", { defaultValue: "Move combo up" })}
              title={t("moveUp", { defaultValue: "Move up" })}
            >
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t("moveDown", { defaultValue: "Move combo down" })}
              title={t("moveDown", { defaultValue: "Move down" })}
            >
              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
            </button>
            <button
              onClick={onDuplicate}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors"
              title={t("duplicate")}
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
            <button
              onClick={onProxy}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors"
              title={t("proxyConfig")}
            >
              <span className="material-symbols-outlined text-[16px]">vpn_lock</span>
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors"
              title={tc("edit")}
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-500/10 rounded text-red-500 transition-colors"
              title={tc("delete")}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
