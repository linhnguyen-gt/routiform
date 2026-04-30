"use client";

import { useMemo, type CSSProperties } from "react";
import Card from "../../Card";
import { fmtCompact as fmt, fmtFull } from "@/shared/utils/formatting";
import { HEATMAP_MONTH_LABELS } from "./chart-constants";

export function ActivityHeatmap({ activityMap }) {
  const cells = useMemo(() => {
    const today = new Date();
    const days = [];
    let maxVal = 0;

    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const raw = activityMap?.[key];
      const val = typeof raw === "number" ? raw : Number(raw) || 0;
      if (val > maxVal) maxVal = val;
      days.push({ date: key, value: val, dayOfWeek: d.getDay() });
    }

    return { days, maxVal };
  }, [activityMap]);

  const weeks = useMemo(() => {
    const w = [];
    let current = [];
    const firstDay = cells.days[0]?.dayOfWeek || 0;
    for (let i = 0; i < firstDay; i++) {
      current.push(null);
    }
    for (const day of cells.days) {
      current.push(day);
      if (current.length === 7) {
        w.push(current);
        current = [];
      }
    }
    if (current.length > 0) w.push(current);
    return w;
  }, [cells]);

  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIdx) => {
      const firstDay = week.find((d) => d !== null);
      if (firstDay) {
        const m = new Date(firstDay.date).getMonth();
        if (m !== lastMonth) {
          labels.push({ weekIdx, label: HEATMAP_MONTH_LABELS[m] });
          lastMonth = m;
        }
      }
    });
    return labels;
  }, [weeks]);

  const weekColW = 13;

  function getCellStyle(value: number): CSSProperties {
    if (!value || value === 0) {
      return { background: "rgba(113, 113, 122, 0.35)" };
    }
    const intensity = Math.min(value / (cells.maxVal || 1), 1);
    const a = 0.28 + intensity * 0.72;
    return {
      background: `rgba(124, 58, 237, ${a.toFixed(3)})`,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)",
    };
  }

  const gridWidthPx = weeks.length * weekColW;

  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden p-4">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Activity</h3>
        <span className="text-xs text-text-muted">
          {Object.keys(activityMap || {}).length} active days ·{" "}
          {fmt(Object.values(activityMap || {}).reduce((a: number, b: number) => a + b, 0))} tokens
          · 365 days
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
        <div className="min-h-0 w-full overflow-x-auto overflow-y-hidden overscroll-x-contain">
          <div className="inline-block min-w-0 align-top">
            <div className="flex gap-[3px]">
              <div className="w-8 shrink-0" aria-hidden />
              <div className="relative mb-1 h-4" style={{ width: gridWidthPx }}>
                {monthLabels.map((m, i) => (
                  <span
                    key={`${m.weekIdx}-${m.label}-${i}`}
                    className="absolute top-0 text-[10px] leading-none text-text-muted"
                    style={{ left: m.weekIdx * weekColW }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-[3px]">
              <div className="flex w-8 shrink-0 flex-col gap-[3px] pr-1 text-[10px] text-text-muted">
                <span className="h-[10px]" />
                <span className="h-[10px] leading-[10px]">Mon</span>
                <span className="h-[10px]" />
                <span className="h-[10px] leading-[10px]">Wed</span>
                <span className="h-[10px]" />
                <span className="h-[10px] leading-[10px]">Fri</span>
                <span className="h-[10px]" />
              </div>

              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => (
                    <div
                      key={day ? day.date : `pad-${wi}-${di}`}
                      title={day ? `${day.date}: ${fmtFull(day.value)} tokens` : ""}
                      className="h-[10px] w-[10px] rounded-[2px]"
                      style={day ? getCellStyle(day.value) : { background: "transparent" }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-border/40 pt-3 pl-8 text-[10px] text-text-muted">
          <span>Less</span>
          <div
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: "rgba(113, 113, 122, 0.35)" }}
          />
          <div
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: "rgba(124, 58, 237, 0.35)" }}
          />
          <div
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: "rgba(124, 58, 237, 0.55)" }}
          />
          <div
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: "rgba(124, 58, 237, 0.75)" }}
          />
          <div
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: "rgba(124, 58, 237, 0.95)" }}
          />
          <span>More</span>
        </div>
      </div>
    </Card>
  );
}
