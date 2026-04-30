"use client";

import Card from "../../Card";
import { fmtFull } from "@/shared/utils/formatting";

export function UsageDetail({ summary }) {
  const items = [
    { label: "Input", value: summary?.promptTokens, color: "text-primary" },
    { label: "Cache read", value: 0, color: "text-text-muted" },
    { label: "Output", value: summary?.completionTokens, color: "text-emerald-500" },
  ];

  return (
    <Card className="p-4 flex-1">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        Usage Detail
      </h3>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className={`text-sm ${item.color}`}>{item.label}</span>
            <span className="font-mono font-medium text-sm">{fmtFull(item.value)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
