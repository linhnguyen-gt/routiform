"use client";

import { Button, Input } from "@/shared/components";
import { CloudflaredTunnelStatus, TunnelNotice, CloudflaredTunnelPhase } from "../types";
import { useTranslations } from "next-intl";

interface CloudflaredTunnelSectionProps {
  status: CloudflaredTunnelStatus | null;
  busy: boolean;
  notice: TunnelNotice | null;
  onAction: (action: "enable" | "disable") => void;
  onCloseNotice: () => void;
  copy: (text: string, id: string) => void;
  copied: string | null;
  translateOrFallback: (key: string, fallback: string, values?: any) => string;
}

export function CloudflaredTunnelSection({
  status,
  busy,
  notice,
  onAction,
  onCloseNotice,
  copy,
  copied,
  translateOrFallback,
}: CloudflaredTunnelSectionProps) {
  const tc = useTranslations("common");

  const phase = status?.phase || "not_installed";
  const phaseMeta: Record<CloudflaredTunnelPhase, { label: string; className: string }> = {
    running: {
      label: translateOrFallback("cloudflaredRunning", "Running"),
      className: "bg-green-500/10 border-green-500/30 text-green-400",
    },
    starting: {
      label: translateOrFallback("cloudflaredStarting", "Starting"),
      className: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    },
    stopped: {
      label: translateOrFallback("cloudflaredStoppedState", "Stopped"),
      className: "bg-surface border-border/70 text-text-muted",
    },
    not_installed: {
      label: translateOrFallback("cloudflaredNotInstalled", "Not installed"),
      className: "bg-surface border-border/70 text-text-muted",
    },
    unsupported: {
      label: translateOrFallback("cloudflaredUnsupported", "Unsupported"),
      className: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    },
    error: {
      label: translateOrFallback("cloudflaredError", "Error"),
      className: "bg-red-500/10 border-red-500/30 text-red-400",
    },
  };

  const actionLabel = status?.running
    ? translateOrFallback("cloudflaredDisable", "Stop Tunnel")
    : status?.installed
      ? translateOrFallback("cloudflaredEnable", "Enable Tunnel")
      : translateOrFallback("cloudflaredInstallAndEnable", "Install & Enable");

  const urlNotice = translateOrFallback(
    "cloudflaredUrlNotice",
    "Creates a temporary Cloudflare Quick Tunnel. The URL changes after every restart."
  );

  return (
    <div className="rounded-xl border border-border/70 bg-surface/40 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">
                {translateOrFallback("cloudflaredTitle", "Cloudflare Quick Tunnel")}
              </h3>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${phaseMeta[phase].className}`}
              >
                {phaseMeta[phase].label}
              </span>
            </div>
          </div>

          {status?.supported !== false && (
            <Button
              size="sm"
              variant={status?.running ? "secondary" : "primary"}
              icon={status?.running ? "cloud_off" : "cloud_upload"}
              onClick={() => onAction(status?.running ? "disable" : "enable")}
              loading={busy}
              className={
                status?.running
                  ? "border-border/70! text-text-muted! hover:text-text!"
                  : "bg-linear-to-r from-primary to-cyan-500 hover:from-primary-hover hover:to-cyan-600"
              }
            >
              {actionLabel}
            </Button>
          )}
        </div>

        {notice && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              notice.type === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : notice.type === "info"
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {notice.type === "success"
                ? "check_circle"
                : notice.type === "info"
                  ? "info"
                  : "error"}
            </span>
            <span className="flex-1">{notice.message}</span>
            <button
              onClick={onCloseNotice}
              className="rounded p-0.5 transition-colors hover:bg-white/10"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        <p className="text-xs text-text-muted">{urlNotice}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={status?.apiUrl || ""}
            readOnly
            placeholder="https://*.trycloudflare.com/v1"
            className="flex-1 min-w-0 font-mono text-sm"
          />
          <Button
            variant="secondary"
            icon={copied === "cloudflared_url" ? "check" : "content_copy"}
            onClick={() => status?.apiUrl && copy(status.apiUrl, "cloudflared_url")}
            disabled={!status?.apiUrl}
            className="shrink-0 self-start sm:self-auto"
          >
            {copied === "cloudflared_url" ? tc("copied") : tc("copy")}
          </Button>
        </div>
        {status?.lastError && (
          <p className="text-xs text-red-400">
            {translateOrFallback("cloudflaredLastError", "Last error: {error}", {
              error: status.lastError,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
