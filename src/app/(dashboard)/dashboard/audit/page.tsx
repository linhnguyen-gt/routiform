"use client";

import { useState, useEffect } from "react";
import ConfigAuditViewer from "./ConfigAuditViewer";

interface AuditSummary {
  totalEntries: number;
}

export default function ConfigAuditPage() {
  const [summary, setSummary] = useState<AuditSummary | null>(null);

  useEffect(() => {
    fetch("/api/audit?summary=true")
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary,#fff)]">
            Configuration Audit
          </h1>
          <p className="text-sm text-[var(--text-secondary,#aaa)] mt-1">
            Track and diff changes made to routing policies, combos, and connections.
          </p>
        </div>
        {summary && (
          <div className="flex items-center gap-4 text-sm bg-[var(--card-bg,#1e1e2e)] px-4 py-2 rounded-xl border border-[var(--border,#333)]">
            <div className="flex flex-col">
              <span className="text-[var(--text-muted,#666)]">Total Audits</span>
              <span className="font-mono text-[var(--text-primary,#fff)] font-semibold">
                {summary.totalEntries}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--card-bg,#1e1e2e)] border border-[var(--border,#333)] rounded-xl overflow-hidden shadow-sm">
        <ConfigAuditViewer />
      </div>
    </div>
  );
}
