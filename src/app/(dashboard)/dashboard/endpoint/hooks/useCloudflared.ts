import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CloudflaredTunnelStatus, TunnelNotice, TranslationValues } from "../types";

export function useCloudflared() {
  const t = useTranslations("endpoint");
  const [cloudflaredStatus, setCloudflaredStatus] = useState<CloudflaredTunnelStatus | null>(null);
  const [cloudflaredBusy, setCloudflaredBusy] = useState(false);
  const [cloudflaredNotice, setCloudflaredNotice] = useState<TunnelNotice | null>(null);

  const translateOrFallback = useCallback(
    (key: string, fallback: string, values?: TranslationValues) => {
      try {
        const message = values ? t(key as never, values as never) : t(key as never);
        if (!message || message === key || message === `endpoint.${key}`) {
          return fallback;
        }
        return message;
      } catch {
        return fallback;
      }
    },
    [t]
  );

  const fetchCloudflaredStatus = useCallback(
    async (silent = false) => {
      try {
        const res = await fetch("/api/tunnels/cloudflared", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            data?.error ||
              translateOrFallback(
                "cloudflaredRequestFailed",
                "Failed to load Cloudflare tunnel status"
              )
          );
        }

        setCloudflaredStatus(data);
        return data as CloudflaredTunnelStatus;
      } catch (error: unknown) {
        if (!silent) {
          setCloudflaredNotice({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : translateOrFallback(
                    "cloudflaredRequestFailed",
                    "Failed to load Cloudflare tunnel status"
                  ),
          });
        }
        return null;
      }
    },
    [translateOrFallback]
  );

  const handleCloudflaredAction = async (action: "enable" | "disable") => {
    setCloudflaredBusy(true);
    setCloudflaredNotice(null);

    try {
      const res = await fetch("/api/tunnels/cloudflared", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            translateOrFallback("cloudflaredRequestFailed", "Failed to update Cloudflare tunnel")
        );
      }

      if (data?.status) {
        setCloudflaredStatus(data.status);
      }

      setCloudflaredNotice({
        type: "success",
        message:
          action === "enable"
            ? translateOrFallback("cloudflaredStarted", "Cloudflare tunnel started")
            : translateOrFallback("cloudflaredStopped", "Cloudflare tunnel stopped"),
      });
    } catch (error: unknown) {
      setCloudflaredNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : translateOrFallback("cloudflaredRequestFailed", "Failed to update Cloudflare tunnel"),
      });
    } finally {
      setCloudflaredBusy(false);
      await fetchCloudflaredStatus(true);
    }
  };

  useEffect(() => {
    if (cloudflaredNotice) {
      const timer = setTimeout(() => setCloudflaredNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [cloudflaredNotice]);

  return {
    cloudflaredStatus,
    cloudflaredBusy,
    cloudflaredNotice,
    fetchCloudflaredStatus,
    handleCloudflaredAction,
    setCloudflaredNotice,
  };
}
