"use client";

import type { ReactNode } from "react";
import { fmtCompact as fmt, fmtCost } from "@/shared/utils/formatting";
import type { TooltipPayloadItem } from "./chart-types";

export function DarkTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  formatter?: (value: unknown) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs shadow-lg">
      {label && <div className="font-semibold text-text-main mb-1">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-text-muted">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-mono font-medium text-text-main">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CostTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs shadow-lg">
      {label && <div className="font-semibold text-text-main mb-1">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-text-muted">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-mono font-medium text-text-main">
            {entry.name === "Cost" ? fmtCost(entry.value) : fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
