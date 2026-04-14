"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { A2AStatus, McpStatus } from "../types";

interface ProtocolsSectionProps {
  mcpStatus: McpStatus | null;
  a2aStatus: A2AStatus | null;
  baseUrl: string;
}

export function ProtocolsSection({ mcpStatus, a2aStatus, baseUrl }: ProtocolsSectionProps) {
  const t = useTranslations("endpoint");
  const tc = useTranslations("common");

  const mcpOnline = Boolean(mcpStatus?.online);
  const a2aOnline = a2aStatus?.status === "ok";
  const mcpToolCount = Number(mcpStatus?.heartbeat?.toolCount || 0);
  const a2aActiveStreams = Number(a2aStatus?.tasks?.activeStreams || 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {t("protocolsTitle") || "Protocols"}
        </h2>
        <p className="text-sm text-text-muted mt-1">
          {t("protocolsDescription") ||
            "MCP and A2A are first-class endpoints with dedicated observability and controls."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-4 bg-bg-subtle">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">hub</span>
                {t("mcpCardTitle") || "MCP Server"}
              </h3>
              <p className="text-xs text-text-muted mt-1">
                {t("mcpCardDescription") || "Model Context Protocol over stdio"}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full font-semibold ${
                mcpOnline ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
              }`}
            >
              {mcpOnline ? tc("active") : tc("inactive")}
            </span>
          </div>
          <div className="mt-3 text-xs text-text-muted space-y-1">
            <p>
              {t("protocolToolsLabel") || "Tools"}:{" "}
              <span className="text-text-main font-semibold">{mcpToolCount || 16}</span>
            </p>
            <p>
              {t("protocolLastActivity") || "Last activity"}:{" "}
              <span className="text-text-main">
                {mcpStatus?.activity?.lastCallAt
                  ? new Date(mcpStatus.activity.lastCallAt).toLocaleString()
                  : "—"}
              </span>
            </p>
          </div>
          <div className="mt-3 rounded-lg bg-bg p-3 border border-border/70">
            <p className="text-xs font-semibold mb-1">{t("quickStart") || "Quick Start"}</p>
            <code className="text-xs font-mono break-all">routiform --mcp</code>
          </div>
          <div className="mt-3">
            <Link
              href="/dashboard/mcp"
              className="text-sm text-primary hover:text-primary-hover transition-colors"
            >
              {t("openMcpDashboard") || "Open MCP management"} →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 bg-bg-subtle">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  group_work
                </span>
                {t("a2aCardTitle") || "A2A Server"}
              </h3>
              <p className="text-xs text-text-muted mt-1">
                {t("a2aCardDescription") || "Agent2Agent JSON-RPC endpoint"}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full font-semibold ${
                a2aOnline ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
              }`}
            >
              {a2aOnline ? tc("active") : tc("inactive")}
            </span>
          </div>
          <div className="mt-3 text-xs text-text-muted space-y-1">
            <p>
              {t("protocolTasksLabel") || "Tasks"}:{" "}
              <span className="text-text-main font-semibold">{a2aStatus?.tasks?.total || 0}</span>
            </p>
            <p>
              {t("protocolActiveStreamsLabel") || "Active streams"}:{" "}
              <span className="text-text-main font-semibold">{a2aActiveStreams}</span>
            </p>
          </div>
          <div className="mt-3 rounded-lg bg-bg p-3 border border-border/70">
            <p className="text-xs font-semibold mb-1">{t("quickStart") || "Quick Start"}</p>
            <code className="text-xs font-mono break-all">{baseUrl.replace(/\/v1$/, "")}/a2a</code>
          </div>
          <div className="mt-3">
            <Link
              href="/dashboard/a2a"
              className="text-sm text-primary hover:text-primary-hover transition-colors"
            >
              {t("openA2aDashboard") || "Open A2A management"} →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-4 bg-bg-subtle">
          <h4 className="font-semibold mb-2">{t("mcpQuickStartTitle") || "MCP Quick Start"}</h4>
          <ol className="text-sm text-text-muted space-y-1 list-decimal list-inside">
            <li>{t("mcpQuickStartStep1") || "Run the MCP server via `routiform --mcp`."}</li>
            <li>
              {t("mcpQuickStartStep2") ||
                "Configure your MCP client to connect over stdio transport."}
            </li>
            <li>
              {t("mcpQuickStartStep3") ||
                "Invoke tools such as `routiform_get_health` and `routiform_list_combos`."}
            </li>
          </ol>
        </div>
        <div className="rounded-xl border border-border p-4 bg-bg-subtle">
          <h4 className="font-semibold mb-2">{t("a2aQuickStartTitle") || "A2A Quick Start"}</h4>
          <ol className="text-sm text-text-muted space-y-1 list-decimal list-inside">
            <li>
              {t("a2aQuickStartStep1") || "Discover the agent card at `/.well-known/agent.json`."}
            </li>
            <li>
              {t("a2aQuickStartStep2") ||
                "Send JSON-RPC requests to `POST /a2a` using `message/send` or `message/stream`."}
            </li>
            <li>
              {t("a2aQuickStartStep3") ||
                "Track and control tasks using `tasks/get` and `tasks/cancel`."}
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
