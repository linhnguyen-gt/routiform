"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import Card from "../../Card";
import { fmtFull } from "@/shared/utils/formatting";
import { createDateFormatter } from "./chart-date-utils";

export function WeeklySquares7d({ activityMap }) {
  const locale = useLocale();
  const weekdayFormatter = useMemo(
    () => createDateFormatter(locale, { weekday: "short" }),
    [locale]
  );
  const dateFormatter = useMemo(
    () => createDateFormatter(locale, { month: "short", day: "numeric" }),
    [locale]
  );
  const days = useMemo(() => {
    if (!activityMap) return [];
    const today = new Date();
    const monday = new Date(today);
    const dow = monday.getDay();
    const deltaToMonday = dow === 0 ? -6 : 1 - dow;
    monday.setDate(monday.getDate() + deltaToMonday);
    monday.setHours(0, 0, 0, 0);

    const result = [];
    let maxVal = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const raw = activityMap[key];
      const val = typeof raw === "number" ? raw : Number(raw) || 0;
      if (val > maxVal) maxVal = val;
      result.push({
        key,
        val,
        label: weekdayFormatter.format(d),
        dateLabel: dateFormatter.format(d),
      });
    }
    return result.map((d) => ({ ...d, intensity: maxVal > 0 ? d.val / maxVal : 0 }));
  }, [activityMap, dateFormatter, weekdayFormatter]);

  function getSquareStyle(intensity) {
    if (intensity === 0) return { background: "rgba(255,255,255,0.04)" };
    const opacity = 0.15 + intensity * 0.75;
    return { background: `rgba(124, 58, 237, ${opacity.toFixed(2)})` };
  }

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-4">
      <h3
        className="mb-3 shrink-0 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Weekly
      </h3>
      <div className="grid w-full min-h-0 flex-1 place-content-center grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((d) => (
          <div key={d.key} className="flex min-w-0 flex-col items-center gap-1">
            <div
              title={`${d.dateLabel}: ${fmtFull(d.val)} tokens`}
              className="aspect-square w-full max-h-10 min-h-[1.75rem] rounded-lg transition-all"
              style={{
                ...getSquareStyle(d.intensity),
                cursor: "default",
              }}
            />
            <span
              className="w-full truncate text-center text-[8px] font-semibold leading-tight tracking-wide sm:text-[9px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
