"use client";

import { useState, useMemo, useCallback } from "react";
import Card from "../../Card";
import { getModelColor } from "@/shared/constants/colors";
import { fmtCompact as fmt, fmtFull, fmtCost } from "@/shared/utils/formatting";
import { SortIndicator } from "./SortIndicator";

export function ModelTable({ byModel, summary: _summary }) {
  const [sortBy, setSortBy] = useState("totalTokens");
  const [sortOrder, setSortOrder] = useState("desc");

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
    const arr = [...(byModel || [])];
    arr.sort((a, b) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      if (typeof va === "string")
        return sortOrder === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortOrder === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [byModel, sortBy, sortOrder]);

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          Model Breakdown
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-text-muted uppercase bg-black/[0.02] dark:bg-white/[0.02]">
            <tr>
              <th
                className="px-4 py-2.5 text-left cursor-pointer group"
                onClick={() => toggleSort("model")}
              >
                Model <SortIndicator active={sortBy === "model"} sortOrder={sortOrder} />
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
            {sorted.map((m, i) => (
              <tr
                key={m.model}
                className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getModelColor(i) }}
                    />
                    <span className="font-medium">{m.model}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-text-muted">
                  {fmtFull(m.requests)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-primary">
                  {fmt(m.promptTokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-emerald-500">
                  {fmt(m.completionTokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold">
                  {fmt(m.totalTokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-amber-500">
                  {fmtCost(m.cost)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${m.pct}%`, backgroundColor: getModelColor(i) }}
                      />
                    </div>
                    <span className="text-xs font-mono text-text-muted w-10 text-right">
                      {m.pct}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
