"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Card from "../../Card";
import { getModelColor } from "@/shared/constants/colors";
import { fmtCompact as fmt } from "@/shared/utils/formatting";
import { DarkTooltip } from "./ChartTooltips";

export function ModelOverTimeChart({ dailyByModel, modelNames }) {
  const data = useMemo(() => dailyByModel || [], [dailyByModel]);
  const models = useMemo(() => modelNames || [], [modelNames]);

  const chartData = useMemo(() => {
    return data.map((d) => {
      const row = { ...d };
      if (d.date) {
        const parts = d.date.split("-");
        row.dateLabel = `${parts[1]}/${parts[2]}`;
      }
      return row;
    });
  }, [data]);

  if (!data.length || !models.length) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Model Usage Over Time
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No data</div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border/50 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Model Usage Over Time
        </h3>
      </div>
      <div className="px-2 pt-3 sm:px-4">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
              tickFormatter={(v) => fmt(v)}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<DarkTooltip formatter={fmt} />} />
            {models.map((m, i) => (
              <Area
                key={m}
                type="monotone"
                dataKey={m}
                stackId="1"
                stroke={getModelColor(i)}
                fill={getModelColor(i)}
                fillOpacity={0.42}
                strokeWidth={1.25}
                animationDuration={600}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="max-h-44 overflow-y-auto border-t border-border/50 bg-black/[0.03] px-4 py-3 dark:bg-white/[0.04]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {models.map((m, i) => (
            <span
              key={m}
              className="flex min-w-0 items-center gap-2 text-[11px] leading-snug text-text-main"
              title={m}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: getModelColor(i) }}
              />
              <span className="min-w-0 truncate font-medium">{m}</span>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
