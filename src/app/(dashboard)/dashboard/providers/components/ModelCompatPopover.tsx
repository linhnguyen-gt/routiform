"use client";

import { Input, Toggle } from "@/shared/components";
import { MODEL_COMPAT_PROTOCOL_KEYS } from "@/shared/constants/modelCompat";
import { UPSTREAM_HEADERS_UI_MAX, compatProtocolLabelKey } from "../providerDetailCompatViewUtils";
import {
  headerRowsToRecord,
  recordToHeaderRows,
  upstreamHeadersRecordsEqual,
} from "../providerDetailCompatUtils";
import type { HeaderDraftRow, ModelCompatPopoverProps } from "../[id]/types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function ModelCompatPopover({
  t,
  effectiveModelNormalize,
  effectiveModelPreserveDeveloper,
  getUpstreamHeadersRecord,
  onCompatPatch,
  showDeveloperToggle = true,
  disabled,
}: ModelCompatPopoverProps) {
  const [open, setOpen] = useState(false);
  const [protocol, setProtocol] = useState<string>(MODEL_COMPAT_PROTOCOL_KEYS[0]);
  const [headerRows, setHeaderRows] = useState<HeaderDraftRow[]>([]);
  const [valuePeekRowId, setValuePeekRowId] = useState<string | null>(null);
  const [valueFocusRowId, setValueFocusRowId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [portalPanelRect, setPortalPanelRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const headerRowIdRef = useRef(0);
  const headerRowsRef = useRef<HeaderDraftRow[]>([]);
  headerRowsRef.current = headerRows;

  const genHeaderRowId = () => {
    headerRowIdRef.current += 1;
    return `uh-${headerRowIdRef.current}`;
  };

  const normalizeToolCallId = effectiveModelNormalize(protocol);
  const preserveDeveloperRole = effectiveModelPreserveDeveloper(protocol);
  const devToggle = showDeveloperToggle && protocol !== "claude";

  const tryCommitHeaderRows = useCallback(
    (rows: HeaderDraftRow[]) => {
      const parsed = headerRowsToRecord(rows);
      const current = getUpstreamHeadersRecord(protocol);
      if (upstreamHeadersRecordsEqual(parsed, current)) return;
      onCompatPatch(protocol, { upstreamHeaders: parsed });
    },
    [getUpstreamHeadersRecord, onCompatPatch, protocol]
  );

  const onHeaderFieldBlur = useCallback(() => {
    queueMicrotask(() => tryCommitHeaderRows(headerRowsRef.current));
  }, [tryCommitHeaderRows]);

  useEffect(() => {
    if (!open) return;
    return () => {
      tryCommitHeaderRows(headerRowsRef.current);
    };
  }, [open, tryCommitHeaderRows]);

  useEffect(() => {
    if (!open) return;
    const rec = getUpstreamHeadersRecord(protocol);
    setHeaderRows(recordToHeaderRows(rec, genHeaderRowId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only on open/protocol change
  }, [open, protocol]);

  useEffect(() => {
    setValuePeekRowId(null);
    setValueFocusRowId(null);
  }, [open, protocol]);

  const namedHeaderCount = headerRows.filter((r) => r.name.trim()).length;
  const canAddHeaderRow = namedHeaderCount < UPSTREAM_HEADERS_UI_MAX;

  const updateHeaderRow = (id: string, patch: Partial<Pick<HeaderDraftRow, "name" | "value">>) => {
    setHeaderRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addHeaderRow = () => {
    if (!canAddHeaderRow) return;
    setHeaderRows((prev) => [...prev, { id: genHeaderRowId(), name: "", value: "" }]);
  };

  const removeHeaderRow = (id: string) => {
    setHeaderRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      const normalized = next.length === 0 ? [{ id: genHeaderRowId(), name: "", value: "" }] : next;
      queueMicrotask(() => tryCommitHeaderRows(normalized));
      return normalized;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = ref.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideTrigger && !insidePanel) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const updatePortalPanelRect = useCallback(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const margin = 10;
    const width = Math.min(window.innerWidth - 2 * margin, 24 * 16);
    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    setPortalPanelRect({ top: rect.bottom + 8, left, width });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPortalPanelRect(null);
      return;
    }
    updatePortalPanelRect();
    window.addEventListener("resize", updatePortalPanelRect);
    window.addEventListener("scroll", updatePortalPanelRect, true);
    return () => {
      window.removeEventListener("resize", updatePortalPanelRect);
      window.removeEventListener("scroll", updatePortalPanelRect, true);
    };
  }, [open, updatePortalPanelRect]);

  const panelChromeClass =
    "flex max-h-[min(82vh,42rem)] flex-col overflow-hidden rounded-xl border-2 border-zinc-200 bg-white shadow-2xl dark:border-zinc-600 dark:bg-zinc-950";

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background text-text-muted hover:bg-muted hover:text-text-main disabled:opacity-50 transition-colors"
        title={t("compatAdjustmentsTitle")}
      >
        <span className="material-symbols-outlined text-base leading-none">tune</span>
        {t("compatButtonLabel")}
      </button>
      {open &&
        typeof document !== "undefined" &&
        portalPanelRect &&
        createPortal(
          <div
            ref={panelRef}
            className={panelChromeClass}
            style={{
              position: "fixed",
              top: portalPanelRect.top,
              left: portalPanelRect.left,
              width: portalPanelRect.width,
              zIndex: 10040,
            }}
          >
            <div className="shrink-0 border-b-2 border-zinc-200 bg-zinc-100 px-3 py-2.5 dark:border-zinc-600 dark:bg-zinc-900">
              <p className="text-xs font-semibold text-text-main">{t("compatAdjustmentsTitle")}</p>
              <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                {t("compatProtocolHint")}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-white p-3 [scrollbar-gutter:stable] [scrollbar-width:thin] dark:bg-zinc-950">
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                {t("compatProtocolLabel")}
              </label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                disabled={disabled}
                className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-zinc-600 dark:bg-zinc-900"
              >
                {MODEL_COMPAT_PROTOCOL_KEYS.map((p) => (
                  <option key={p} value={p}>
                    {t(compatProtocolLabelKey(p))}
                  </option>
                ))}
              </select>
              <div className="flex flex-col gap-3.5">
                <Toggle
                  size="sm"
                  label={t("compatToolIdShort")}
                  title={t("normalizeToolCallIdLabel")}
                  checked={normalizeToolCallId}
                  onChange={(v) => onCompatPatch(protocol, { normalizeToolCallId: v })}
                  disabled={disabled}
                />
                {devToggle && (
                  <Toggle
                    size="sm"
                    label={t("compatDoNotPreserveDeveloper")}
                    title={t("preserveDeveloperRoleLabel")}
                    checked={preserveDeveloperRole === false}
                    onChange={(checked) =>
                      onCompatPatch(protocol, { preserveOpenAIDeveloperRole: !checked })
                    }
                    disabled={disabled}
                  />
                )}
              </div>
              <div className="mt-4 rounded-lg border-2 border-zinc-200 bg-zinc-100 p-3 dark:border-zinc-600 dark:bg-zinc-900">
                <label className="block text-[11px] font-semibold text-text-main mb-1">
                  {t("compatUpstreamHeadersLabel")}
                </label>
                <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                  {t("compatUpstreamHeadersHint")}
                </p>
                <div className="space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 items-end text-[10px] font-medium uppercase tracking-wide text-text-muted px-0.5">
                    <span>{t("compatUpstreamHeaderName")}</span>
                    <span className="col-span-1">{t("compatUpstreamHeaderValue")}</span>
                    <span className="w-8 shrink-0" aria-hidden />
                  </div>
                  {headerRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 items-center"
                    >
                      <Input
                        value={row.name}
                        onChange={(e) => updateHeaderRow(row.id, { name: e.target.value })}
                        onBlur={onHeaderFieldBlur}
                        disabled={disabled}
                        placeholder="Authentication"
                        className="gap-0 min-w-0"
                        inputClassName="h-9 bg-white py-1.5 px-2 text-xs font-mono dark:bg-zinc-900"
                        autoComplete="off"
                      />
                      <div
                        className="min-w-0"
                        onMouseEnter={() => setValuePeekRowId(row.id)}
                        onMouseLeave={() =>
                          setValuePeekRowId((cur) => (cur === row.id ? null : cur))
                        }
                      >
                        <Input
                          type={
                            valuePeekRowId === row.id || valueFocusRowId === row.id
                              ? "text"
                              : "password"
                          }
                          value={row.value}
                          onChange={(e) => updateHeaderRow(row.id, { value: e.target.value })}
                          onFocus={() => setValueFocusRowId(row.id)}
                          onBlur={() => {
                            setValueFocusRowId((cur) => (cur === row.id ? null : cur));
                            onHeaderFieldBlur();
                          }}
                          disabled={disabled}
                          placeholder="•••"
                          className="gap-0 min-w-0"
                          inputClassName="h-9 bg-white py-1.5 px-2 text-xs dark:bg-zinc-900"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={disabled || headerRows.length <= 1}
                        onClick={() => removeHeaderRow(row.id)}
                        title={t("compatUpstreamRemoveRow")}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 text-text-muted hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg leading-none">
                          close
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={disabled || !canAddHeaderRow}
                  onClick={addHeaderRow}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  <span className="material-symbols-outlined text-base leading-none">add</span>
                  {t("compatUpstreamAddRow")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
