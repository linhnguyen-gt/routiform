"use client";

import { useState, useMemo, useCallback } from "react";
import Card from "../../Card";
import { fmtCompact as fmt, fmtFull, fmtCost } from "@/shared/utils/formatting";
import { SortIndicator } from "./SortIndicator";
import { PROVIDER_CHART_COLORS } from "./chart-constants";

export function ProviderTable({ byProvider }) {
  const [sortBy, setSortBy] = useState("totalTokens");
  const [sortOrder, setSortOrder] = useState("desc");

  const data = useMemo(() => byProvider || [], [byProvider]);
  const totalTokens = useMemo(() => data.reduce((acc, p) => acc + p.totalTokens, 0), [data]);

  const toggleSort = useCallback(
    (field) => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(field);
        setSortOrder("desc");
      }
    },
    [sortBy]
  );

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      if (typeof va === "string")
        return sortOrder === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortOrder === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [data, sortBy, sortOrder]);

  if (!data.length) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Provider Breakdown
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No data</div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          Provider Breakdown
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-text-muted uppercase bg-black/[0.02] dark:bg-white/[0.02]">
            <tr>
              <th
                className="px-4 py-2.5 text-left cursor-pointer group"
                onClick={() => toggleSort("provider")}
              >
                Provider <SortIndicator active={sortBy === "provider"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("requests")}
              >
                Requests <SortIndicator active={sortBy === "requests"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("promptTokens")}
              >
                Input <SortIndicator active={sortBy === "promptTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("completionTokens")}
              >
                Output{" "}
                <SortIndicator active={sortBy === "completionTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("totalTokens")}
              >
                Total <SortIndicator active={sortBy === "totalTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("cost")}
              >
                Cost <SortIndicator active={sortBy === "cost"} sortOrder={sortOrder} />
              </th>
              <th className="px-4 py-2.5 text-right w-36">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((p, i) => {
              const pct = totalTokens > 0 ? ((p.totalTokens / totalTokens) * 100).toFixed(1) : "0";
              return (
                <tr
                  key={p.provider}
                  className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: PROVIDER_CHART_COLORS[i % PROVIDER_CHART_COLORS.length],
                        }}
                      />
                      <span className="font-medium capitalize">{p.provider}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-muted">
                    {fmtFull(p.requests)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-primary">
                    {fmt(p.promptTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-500">
                    {fmt(p.completionTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">
                    {fmt(p.totalTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-500">
                    {fmtCost(p.cost)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              PROVIDER_CHART_COLORS[i % PROVIDER_CHART_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-text-muted w-10 text-right">
                        {pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
