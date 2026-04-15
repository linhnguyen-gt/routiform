"use client";

import { useState, useEffect, useCallback } from "react";
import { SegmentedControl } from "@/shared/components";
import EndpointPageClient from "./EndpointPageClient";
import McpDashboardPage from "./components/MCPDashboard";
import A2ADashboardPage from "./components/A2ADashboard";
import ApiEndpointsTab from "./ApiEndpointsTab";
import { useTranslations } from "next-intl";
import { copyToClipboard } from "@/shared/utils/clipboard";
import { cn } from "@/shared/utils/cn";

type ServiceStatus = {
  online: boolean;
  loading: boolean;
};

type McpTransport = "stdio" | "sse" | "streamable-http";

/* ────── Modern Service Toggle ────── */
function ServiceToggle({
  label,
  status,
  enabled,
  onToggle,
  toggling,
}: {
  label: string;
  status: ServiceStatus;
  enabled: boolean;
  onToggle: () => void;
  toggling: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      {/* Status Badge */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all duration-200",
          status.loading
            ? "border-border bg-surface text-text-muted"
            : status.online
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            status.loading
              ? "bg-text-muted"
              : status.online
                ? "bg-green-400 animate-pulse"
                : "bg-red-400"
          )}
        />
        {status.loading ? "Checking..." : status.online ? "Online" : "Offline"}
      </div>

      {/* Toggle Switch */}
      <button
        onClick={onToggle}
        disabled={toggling}
        className={cn(
          "relative inline-flex items-center h-8 w-14 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 border-2",
          enabled ? "bg-green-500 border-green-400/50" : "bg-surface-hover border-border",
          toggling && "opacity-50 cursor-wait"
        )}
        title={enabled ? `Disable ${label}` : `Enable ${label}`}
      >
        <span
          className={cn(
            "inline-block w-6 h-6 rounded-full shadow-lg transition-all duration-300",
            enabled ? "translate-x-7 bg-white" : "translate-x-1 bg-text-muted"
          )}
        />
      </button>

      {/* Status Text */}
      <span
        className={cn(
          "text-sm font-bold min-w-[32px] transition-colors duration-200",
          enabled ? "text-green-400" : "text-text-muted"
        )}
      >
        {toggling ? "..." : enabled ? "ON" : "OFF"}
      </span>
    </div>
  );
}

/* ────── Modern Transport Selector ────── */
function TransportSelector({
  value,
  onChange,
  disabled,
  baseUrl,
}: {
  value: McpTransport;
  onChange: (t: McpTransport) => void;
  disabled: boolean;
  baseUrl: string;
}) {
  const options: { value: McpTransport; label: string; desc: string; icon: string }[] = [
    {
      value: "stdio",
      label: "stdio",
      desc: "Local — IDE spawns process via routiform --mcp",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
      value: "sse",
      label: "SSE",
      desc: "Remote — Server-Sent Events over HTTP",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
    {
      value: "streamable-http",
      label: "Streamable HTTP",
      desc: "Remote — Modern bidirectional HTTP",
      icon: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
    },
  ];

  const urlMap: Record<McpTransport, string> = {
    stdio: "routiform --mcp",
    sse: `${baseUrl}/api/mcp/sse`,
    "streamable-http": `${baseUrl}/api/mcp/stream`,
  };

  return (
    <div className="rounded-xl border-2 border-border bg-surface p-6 shadow-lg">
      <div className="mb-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <svg
            className="w-5 h-5 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        </div>
        <span className="text-lg font-bold text-text-main">Transport Mode</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            className={cn(
              "group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all duration-200",
              value === opt.value
                ? "border-blue-500 bg-blue-500/10 shadow-lg"
                : "border-border bg-surface-hover hover:border-blue-500/50 hover:shadow-md",
              disabled && "cursor-wait opacity-50"
            )}
          >
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <svg
                  className={cn(
                    "w-5 h-5 transition-colors duration-200",
                    value === opt.value
                      ? "text-blue-400"
                      : "text-text-muted group-hover:text-blue-400"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={opt.icon} />
                </svg>
                <span
                  className={cn(
                    "text-base font-bold transition-colors duration-200",
                    value === opt.value ? "text-blue-400" : "text-text-main"
                  )}
                >
                  {opt.label}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">{opt.desc}</p>
            </div>

            {/* Selection Indicator */}
            {value === opt.value && (
              <div className="absolute top-2 right-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Hover Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-violet-500/0 group-hover:from-blue-500/5 group-hover:to-violet-500/5 transition-all duration-300 pointer-events-none"></div>
          </button>
        ))}
      </div>

      {/* URL Display */}
      <div className="mt-4 flex items-center gap-3 rounded-lg border-2 border-border bg-surface-hover p-3">
        <svg
          className="w-5 h-5 text-text-muted shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={
              value === "stdio"
                ? "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                : "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            }
          />
        </svg>
        <code className="flex-1 text-sm font-mono text-text-muted break-all">{urlMap[value]}</code>
        {value !== "stdio" && (
          <button
            type="button"
            className="shrink-0 px-3 py-1.5 rounded-lg border-2 border-border text-xs font-semibold text-text-muted hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-200 active:scale-95"
            onClick={() => void copyToClipboard(urlMap[value])}
            title="Copy URL"
          >
            Copy
          </button>
        )}
      </div>
    </div>
  );
}

/* ────── Main Page ────── */
export default function EndpointPage() {
  const [activeTab, setActiveTab] = useState("endpoint-proxy");
  const t = useTranslations("endpoints");
  const th = useTranslations("header");

  const [mcpStatus, setMcpStatus] = useState<ServiceStatus>({ online: false, loading: true });
  const [a2aStatus, setA2aStatus] = useState<ServiceStatus>({ online: false, loading: true });
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [a2aEnabled, setA2aEnabled] = useState(false);
  const [mcpToggling, setMcpToggling] = useState(false);
  const [a2aToggling, setA2aToggling] = useState(false);
  const [mcpTransport, setMcpTransport] = useState<McpTransport>("stdio");
  const [transportSaving, setTransportSaving] = useState(false);

  const [baseUrl, setBaseUrl] = useState("");

  // Detect base URL from browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(`${window.location.protocol}//${window.location.host}`);
    }
  }, []);

  // Fetch initial settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setMcpEnabled(!!data.mcpEnabled);
          setA2aEnabled(!!data.a2aEnabled);
          setMcpTransport((data.mcpTransport as McpTransport) || "stdio");
        }
      } catch {
        // defaults stay
      }
    };
    void fetchSettings();
  }, []);

  const patchSetting = useCallback(async (body: Record<string, unknown>) => {
    return fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }, []);

  const toggleService = useCallback(
    async (service: "mcp" | "a2a") => {
      const setToggling = service === "mcp" ? setMcpToggling : setA2aToggling;
      const setEnabled = service === "mcp" ? setMcpEnabled : setA2aEnabled;
      const currentlyEnabled = service === "mcp" ? mcpEnabled : a2aEnabled;
      const newValue = !currentlyEnabled;

      setToggling(true);
      try {
        const res = await patchSetting({
          [service === "mcp" ? "mcpEnabled" : "a2aEnabled"]: newValue,
        });
        if (res.ok) setEnabled(newValue);
      } catch {
        // keep current state
      } finally {
        setToggling(false);
      }
    },
    [mcpEnabled, a2aEnabled, patchSetting]
  );

  const changeTransport = useCallback(
    async (newTransport: McpTransport) => {
      setTransportSaving(true);
      try {
        const res = await patchSetting({ mcpTransport: newTransport });
        if (res.ok) setMcpTransport(newTransport);
      } catch {
        // keep current
      } finally {
        setTransportSaving(false);
      }
    },
    [patchSetting]
  );

  const refreshMcpStatus = useCallback(async () => {
    setMcpStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/mcp/status");
      if (res.ok) {
        const data = await res.json();
        setMcpStatus({ online: !!data.online, loading: false });
      } else {
        setMcpStatus({ online: false, loading: false });
      }
    } catch {
      setMcpStatus({ online: false, loading: false });
    }
  }, []);

  const refreshA2aStatus = useCallback(async () => {
    setA2aStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/a2a/status");
      if (res.ok) {
        const data = await res.json();
        setA2aStatus({ online: data.status === "ok", loading: false });
      } else {
        setA2aStatus({ online: false, loading: false });
      }
    } catch {
      setA2aStatus({ online: false, loading: false });
    }
  }, []);

  useEffect(() => {
    const load = () => {
      void refreshMcpStatus();
      void refreshA2aStatus();
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [refreshMcpStatus, refreshA2aStatus]);

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-violet-600 p-8 shadow-xl">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">{th("endpoint")}</h1>
          <p className="mt-2 max-w-2xl text-base text-blue-50 leading-relaxed">
            {th("endpointDescription")}
          </p>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Tab Navigation with Service Toggles */}
      <div className="rounded-xl border-2 border-border bg-surface p-4 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 overflow-x-auto">
            <SegmentedControl
              options={[
                { value: "endpoint-proxy", label: t("tabProxy"), icon: "api" },
                { value: "mcp", label: "MCP", icon: "hub" },
                { value: "a2a", label: "A2A", icon: "group_work" },
                { value: "api-endpoints", label: t("tabApiEndpoints"), icon: "code" },
              ]}
              value={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {/* Service Toggles */}
          <div className="flex items-center gap-4 border-t-2 border-border pt-4 lg:border-t-0 lg:pt-0 lg:pl-4 lg:border-l-2">
            {activeTab === "mcp" && (
              <ServiceToggle
                label="MCP"
                status={mcpStatus}
                enabled={mcpEnabled}
                onToggle={() => void toggleService("mcp")}
                toggling={mcpToggling}
              />
            )}
            {activeTab === "a2a" && (
              <ServiceToggle
                label="A2A"
                status={a2aStatus}
                enabled={a2aEnabled}
                onToggle={() => void toggleService("a2a")}
                toggling={a2aToggling}
              />
            )}
          </div>
        </div>
      </div>

      {/* Transport Selector (MCP only) */}
      {activeTab === "mcp" && mcpEnabled && (
        <TransportSelector
          value={mcpTransport}
          onChange={(tr) => void changeTransport(tr)}
          disabled={transportSaving}
          baseUrl={baseUrl}
        />
      )}

      {/* Tab Content */}
      <div className="flex flex-col gap-6">
        {activeTab === "endpoint-proxy" && <EndpointPageClient machineId="" />}
        {activeTab === "mcp" && <McpDashboardPage />}
        {activeTab === "a2a" && <A2ADashboardPage />}
        {activeTab === "api-endpoints" && <ApiEndpointsTab />}
      </div>
    </div>
  );
}
