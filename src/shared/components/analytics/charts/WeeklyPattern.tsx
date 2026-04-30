"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../../Card";
import { fmtCompact as fmt } from "@/shared/utils/formatting";
import { DarkTooltip } from "./ChartTooltips";

export function WeeklyPattern({ weeklyPattern }) {
  const chartData = useMemo(() => {
    return (weeklyPattern || []).map((w) => ({
      day: w.day.slice(0, 3),
      Tokens: w.totalTokens,
    }));
  }, [weeklyPattern]);

  return (
    <Card className="px-4 py-3">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
        Weekly
      </h3>
      <ResponsiveContainer width="100%" height={48}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 9, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<DarkTooltip formatter={fmt} />}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar
            dataKey="Tokens"
            fill="var(--color-text-muted)"
            opacity={0.3}
            radius={[3, 3, 0, 0]}
            animationDuration={400}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
