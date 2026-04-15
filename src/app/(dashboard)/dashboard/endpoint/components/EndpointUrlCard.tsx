"use client";

import { Card, Button, Input } from "@/shared/components";
import { useTranslations } from "next-intl";
import { CloudStatus } from "../types";

interface EndpointUrlCardProps {
  cloudEnabled: boolean;
  cloudSyncing: boolean;
  cloudConfigured: boolean;
  resolvedMachineId: string;
  currentEndpoint: string;
  cloudStatus: CloudStatus | null;
  onCloudToggle: (checked: boolean) => void;
  copy: (text: string, id: string) => void;
  copied: string | null;
  onCloseStatus: () => void;
}

export function EndpointUrlCard({
  cloudEnabled,
  cloudSyncing,
  cloudConfigured,
  resolvedMachineId,
  currentEndpoint,
  cloudStatus,
  onCloudToggle,
  copy,
  copied,
  onCloseStatus,
}: EndpointUrlCardProps) {
  const t = useTranslations("endpoint");
  const tc = useTranslations("common");

  return (
    <Card className="rounded-xl border-border/50 shadow-sm">
      <div className="mb-4 flex flex-col gap-4 border-b border-border/40 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-text-muted/80" aria-hidden>
              hub
            </span>
            <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              variant={cloudEnabled ? "primary" : "secondary"}
              icon={cloudEnabled ? "cloud_done" : "dns"}
              onClick={() => onCloudToggle(!cloudEnabled)}
              disabled={cloudSyncing || (!cloudEnabled && !cloudConfigured)}
              className={cloudEnabled ? "" : "border-border/70! text-text-muted! hover:text-text!"}
            >
              {cloudEnabled ? t("usingCloudProxy") : t("usingLocalServer")}
            </Button>
          </div>
          {resolvedMachineId && (
            <p className="text-xs text-text-muted mt-2">
              {t("machineId", { id: resolvedMachineId.slice(0, 8) })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {cloudEnabled ? (
            <Button
              size="sm"
              variant="secondary"
              icon="cloud_off"
              onClick={() => onCloudToggle(false)}
              disabled={cloudSyncing}
              className="bg-red-500/10! text-red-500! hover:bg-red-500/20! border-red-500/30!"
            >
              {t("disableCloud")}
            </Button>
          ) : cloudConfigured ? (
            <Button
              variant="primary"
              icon="cloud_upload"
              onClick={() => onCloudToggle(true)}
              disabled={cloudSyncing}
              className="bg-linear-to-r from-primary to-blue-500 hover:from-primary-hover hover:to-blue-600"
            >
              {t("enableCloud")}
            </Button>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-surface text-text-muted border border-border/70">
              Cloud not configured
            </span>
          )}
        </div>
      </div>

      {/* Cloud Status Toast */}
      {cloudStatus && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
            cloudStatus.type === "success"
              ? "bg-green-500/10 border border-green-500/30 text-green-400"
              : cloudStatus.type === "warning"
                ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {cloudStatus.type === "success"
              ? "check_circle"
              : cloudStatus.type === "warning"
                ? "warning"
                : "error"}
          </span>
          <span className="flex-1">{cloudStatus.message}</span>
          <button
            onClick={onCloseStatus}
            className="p-0.5 hover:bg-white/10 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Endpoint URL */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Input
          value={currentEndpoint}
          readOnly
          className={`flex-1 min-w-0 font-mono text-sm ${cloudEnabled ? "animate-border-glow" : ""}`}
        />
        <Button
          variant="secondary"
          icon={copied === "endpoint_url" ? "check" : "content_copy"}
          onClick={() => copy(currentEndpoint, "endpoint_url")}
          className="shrink-0 self-start sm:self-auto"
        >
          {copied === "endpoint_url" ? tc("copied") : tc("copy")}
        </Button>
      </div>
    </Card>
  );
}
