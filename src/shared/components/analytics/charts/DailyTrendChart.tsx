"use client";

import { useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../../Card";
import { CostTooltip } from "./ChartTooltips";

export function DailyTrendChart({ dailyTrend }) {
  const chartData = useMemo(() => {
    return (dailyTrend || []).map((d) => ({
      date: d.date.slice(5),
      Input: d.promptTokens,
      Output: d.completionTokens,
      Cost: d.cost || 0,
    }));
  }, [dailyTrend]);

  const hasCost = useMemo(() => chartData.some((d) => d.Cost > 0), [chartData]);

  if (!chartData.length) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Token Trend
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No data</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex-1">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        Token &amp; Cost Trend
      </h3>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart
          data={chartData}
          margin={{ top: 0, right: hasCost ? 40 : 0, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(Math.floor(chartData.length / 6), 0)}
          />
          {hasCost && (
            <YAxis
              yAxisId="cost"
              orientation="right"
              tick={{ fontSize: 8, fill: "#f59e0b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              width={36}
            />
          )}
          <Tooltip content={<CostTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar
            dataKey="Input"
            stackId="a"
            fill="var(--primary)"
            opacity={0.7}
            radius={[0, 0, 0, 0]}
            animationDuration={600}
          />
          <Bar
            dataKey="Output"
            stackId="a"
            fill="#10b981"
            opacity={0.7}
            radius={[3, 3, 0, 0]}
            animationDuration={600}
          />
          {hasCost && (
            <Line
              yAxisId="cost"
              type="monotone"
              dataKey="Cost"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              animationDuration={600}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary/70" /> Input
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500/70" /> Output
        </span>
        {hasCost && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500/70" /> Cost ($)
          </span>
        )}
      </div>
    </Card>
  );
}
