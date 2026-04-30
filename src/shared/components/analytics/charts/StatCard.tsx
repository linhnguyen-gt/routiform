"use client";

import type { ReactNode } from "react";
import Card from "../../Card";

export function StatCard({
  icon,
  label,
  value,
  subValue,
  color = "text-text-main",
  tone = "default",
}: {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  subValue?: ReactNode;
  color?: string;
  /** warning = cost/fallback attention; keeps layout consistent */
  tone?: "default" | "warning";
}) {
  return (
    <Card
      className={`flex flex-col gap-1 px-4 py-3 ${
        tone === "warning" ? "ring-1 ring-amber-500/20 border-amber-500/15" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        <span className="material-symbols-outlined text-[16px] text-primary/80">{icon}</span>
        {label}
      </div>
      <span className={`text-2xl font-bold tabular-nums tracking-tight ${color}`}>{value}</span>
      {subValue && <span className="text-xs text-text-muted">{subValue}</span>}
    </Card>
  );
}
