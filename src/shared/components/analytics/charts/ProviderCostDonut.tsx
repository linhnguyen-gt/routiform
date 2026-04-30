"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../../Card";
import { fmtCost } from "@/shared/utils/formatting";
import { DarkTooltip } from "./ChartTooltips";
import { PROVIDER_CHART_COLORS } from "./chart-constants";

export function ProviderCostDonut({ byProvider }) {
  const data = useMemo(() => byProvider || [], [byProvider]);
  const hasData = data.length > 0 && data.some((p) => p.cost > 0);

  const pieData = useMemo(() => {
    return data
      .filter((item) => item.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8)
      .map((item, i) => ({
        name: item.provider,
        value: item.cost,
        fill: PROVIDER_CHART_COLORS[i % PROVIDER_CHART_COLORS.length],
      }));
  }, [data]);

  if (!hasData) {
    return (
      <Card className="p-4 flex-1">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Cost by Provider
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No cost data</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex-1">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        Cost by Provider
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={55}
              paddingAngle={1}
              animationDuration={600}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<DarkTooltip formatter={fmtCost} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {pieData.map((seg, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: seg.fill }}
                />
                <span className="truncate text-text-main capitalize">{seg.name}</span>
              </div>
              <span className="font-mono font-medium text-amber-500 shrink-0">
                {fmtCost(seg.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
