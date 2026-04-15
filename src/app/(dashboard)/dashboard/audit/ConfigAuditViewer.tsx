"use client";

import { useState, useEffect } from "react";

interface ConfigDiff {
  added: string[];
  removed: string[];
  changed: Array<{ key: string; from: unknown; to: unknown }>;
  isEmpty: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  targetId: string;
  targetName: string;
  source: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: ConfigDiff;
  note: string | null;
}

export default function ConfigAuditViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "text-green-400 bg-green-400/10 border-green-500/20";
      case "update":
        return "text-blue-400 bg-blue-400/10 border-blue-500/20";
      case "delete":
        return "text-red-400 bg-red-400/10 border-red-500/20";
      default:
        return "text-gray-400 bg-gray-400/10 border-gray-500/20";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted,#666)]">
        <svg
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          className="w-12 h-12 mb-4 opacity-50"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p>No Configuration Audit Logs found.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--border,#333)] text-[var(--text-secondary,#aaa)] text-sm">
              <th className="px-6 py-4 font-medium">Timestamp</th>
              <th className="px-6 py-4 font-medium">Action</th>
              <th className="px-6 py-4 font-medium">Target</th>
              <th className="px-6 py-4 font-medium">Resource</th>
              <th className="px-6 py-4 font-medium">Source</th>
              <th className="px-6 py-4 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border,#333)]">
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="hover:bg-[var(--hover-bg,#2a2a3e)] transition-colors group"
              >
                <td className="px-6 py-3 whitespace-nowrap text-sm text-[var(--text-secondary,#aaa)]">
                  {new Date(entry.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-md border capitalize ${getActionColor(entry.action)}`}
                  >
                    {entry.action}
                  </span>
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-[var(--text-primary,#fff)] font-medium capitalize">
                  {entry.target}
                </td>
                <td className="px-6 py-3 text-sm text-[var(--text-secondary,#aaa)] font-mono">
                  {entry.targetName}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-[var(--text-muted,#666)] capitalize">
                  {entry.source}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-right">
                  <button
                    onClick={() => setSelectedEntry(entry)}
                    className="px-3 py-1 text-xs font-medium text-[var(--text-primary,#fff)] bg-[var(--accent,#7c3aed)] hover:bg-opacity-80 rounded-md transition-colors invisible group-hover:visible"
                  >
                    View Diff
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg,#1e1e2e)] border border-[var(--border,#333)] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border,#333)] bg-[#15151f]">
              <div>
                <h3 className="text-xl font-semibold text-[var(--text-primary,#fff)] capitalize">
                  {selectedEntry.action} {selectedEntry.target}
                </h3>
                <p className="text-sm text-[var(--text-secondary,#aaa)] font-mono mt-1">
                  ID: {selectedEntry.targetId} • {selectedEntry.targetName}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-2 text-[var(--text-muted,#666)] hover:text-white bg-[var(--hover-bg,#2a2a3e)] hover:bg-[#333] rounded-full transition-colors"
                title="Close"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#1a1a24]">
              {selectedEntry.note && (
                <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-xl text-sm italic">
                  📝 {selectedEntry.note}
                </div>
              )}

              {selectedEntry.diff?.isEmpty ? (
                <div className="text-center p-8 text-[var(--text-muted,#666)]">
                  No changes detected in Diff
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Added Keys */}
                  {selectedEntry.diff?.added?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-green-400 mb-2 uppercase tracking-wider">
                        ++ Added Properties
                      </h4>
                      <pre className="bg-[#111116] border border-green-500/20 rounded-xl p-4 overflow-x-auto text-xs font-mono text-green-300 shadow-inner">
                        {JSON.stringify(
                          selectedEntry.diff.added.reduce(
                            (acc, key) => ({ ...acc, [key]: selectedEntry.after?.[key] }),
                            {}
                          ),
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}

                  {/* Removed Keys */}
                  {selectedEntry.diff?.removed?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-400 mb-2 uppercase tracking-wider">
                        -- Removed Properties
                      </h4>
                      <pre className="bg-[#111116] border border-red-500/20 rounded-xl p-4 overflow-x-auto text-xs font-mono text-red-300 shadow-inner">
                        {JSON.stringify(
                          selectedEntry.diff.removed.reduce(
                            (acc, key) => ({ ...acc, [key]: selectedEntry.before?.[key] }),
                            {}
                          ),
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}

                  {/* Changed Keys */}
                  {selectedEntry.diff?.changed?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-400 mb-2 uppercase tracking-wider">
                        ~ Modified Properties
                      </h4>
                      <div className="space-y-2">
                        {selectedEntry.diff.changed.map((change, idx) => (
                          <div
                            key={idx}
                            className="bg-[#111116] border border-yellow-500/20 rounded-xl overflow-hidden shadow-inner text-sm font-mono flex flex-col"
                          >
                            <div className="px-4 py-2 bg-[#1b1b22] border-b border-[#2d2d3a] text-yellow-500/80 font-semibold">
                              {change.key}
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-[#2d2d3a]">
                              <div className="p-4 bg-red-500/5 text-red-300/80">
                                <div className="text-[10px] text-red-400/50 mb-1 uppercase">
                                  Before
                                </div>
                                <pre className="whitespace-pre-wrap break-words">
                                  {JSON.stringify(change.from, null, 2)}
                                </pre>
                              </div>
                              <div className="p-4 bg-green-500/5 text-green-300/80">
                                <div className="text-[10px] text-green-400/50 mb-1 uppercase">
                                  After
                                </div>
                                <pre className="whitespace-pre-wrap break-words">
                                  {JSON.stringify(change.to, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
