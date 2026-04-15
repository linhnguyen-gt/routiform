"use client";

import type { ProviderConnectionRef } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionsConnectionsSectionProps {
  connections: ProviderConnectionRef[];
  selectedConnections: string[];
  allowAllConnections: boolean;
  onToggleConnection: (connectionId: string) => void;
  onSetAllowAllConnections: (v: boolean) => void;
  onSetSelectedConnections: (v: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionsConnectionsSection({
  connections,
  selectedConnections,
  allowAllConnections,
  onToggleConnection,
  onSetAllowAllConnections,
  onSetSelectedConnections,
}: PermissionsConnectionsSectionProps) {
  if (connections.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-surface/40">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-main">Allowed Connections</p>
        <div className="flex gap-1 p-0.5 bg-surface rounded-md">
          <button
            onClick={() => {
              onSetAllowAllConnections(true);
              onSetSelectedConnections([]);
            }}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              allowAllConnections
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            All
          </button>
          <button
            onClick={() => onSetAllowAllConnections(false)}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              !allowAllConnections
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            Restrict
          </button>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        {allowAllConnections
          ? "This key can use any active connection."
          : `Restricted to ${selectedConnections.length} connection${selectedConnections.length !== 1 ? "s" : ""}.`}
      </p>
      {!allowAllConnections && (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {Object.entries(
            connections.reduce<Record<string, ProviderConnectionRef[]>>((acc, conn) => {
              const p = conn.provider || "Other";
              if (!acc[p]) acc[p] = [];
              acc[p].push(conn);
              return acc;
            }, {})
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([provider, conns]) => (
              <div key={provider}>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1 py-0.5">
                  {provider}
                </p>
                {conns.map((conn) => {
                  const isSelected = selectedConnections.includes(conn.id);
                  return (
                    <button
                      key={conn.id}
                      onClick={() => onToggleConnection(conn.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all ${
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "text-text-muted hover:bg-surface/50 hover:text-text-main"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-primary border-primary" : "border-border"
                        }`}
                      >
                        {isSelected && (
                          <span className="material-symbols-outlined text-white text-[10px]">
                            check
                          </span>
                        )}
                      </div>
                      <span className="truncate flex-1">{conn.name || conn.id.slice(0, 8)}</span>
                      {!conn.isActive && (
                        <span className="text-[9px] text-red-400 shrink-0">inactive</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
