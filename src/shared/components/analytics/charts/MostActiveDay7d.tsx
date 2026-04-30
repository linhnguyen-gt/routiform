"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import Card from "../../Card";
import { fmtCompact as fmt } from "@/shared/utils/formatting";
import { createDateFormatter } from "./chart-date-utils";

export function MostActiveDay7d({ activityMap }) {
  const locale = useLocale();
  const weekdayFormatter = useMemo(
    () => createDateFormatter(locale, { weekday: "long" }),
    [locale]
  );
  const dateFormatter = useMemo(
    () => createDateFormatter(locale, { month: "short", day: "numeric" }),
    [locale]
  );
  const data = useMemo(() => {
    if (!activityMap) return null;
    const today = new Date();
    let peakKey = null;
    let peakVal = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const raw = activityMap[key];
      const val = typeof raw === "number" ? raw : Number(raw) || 0;
      if (val > peakVal) {
        peakVal = val;
        peakKey = key;
      }
    }
    if (!peakKey || peakVal === 0) return null;

    const peakDate = new Date(peakKey + "T12:00:00");
    return {
      weekday: weekdayFormatter.format(peakDate),
      label: dateFormatter.format(peakDate),
      tokens: peakVal,
    };
  }, [activityMap, dateFormatter, weekdayFormatter]);

  return (
    <Card className="relative isolate flex h-full min-h-0 min-w-0 flex-col justify-center overflow-hidden p-4">
      <h3
        className="mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Most Active Day
      </h3>
      {data ? (
        <>
          <span className="text-xl font-bold capitalize" style={{ lineHeight: 1.2 }}>
            {data.weekday}
          </span>
          <span className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {data.label} · {fmt(data.tokens)} tokens
          </span>
        </>
      ) : (
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          No data in the last 7 days
        </span>
      )}
    </Card>
  );
}
