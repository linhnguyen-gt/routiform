import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CloudStatus } from "../types";

const CLOUD_ACTION_TIMEOUT_MS = 15000;

export function useCloudSync(initialMachineId: string, initialCloudBaseUrl: string | null = null) {
  const t = useTranslations("endpoint");
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [syncStep, setSyncStep] = useState<"syncing" | "verifying" | "disabling" | "done" | "">("");
  const [modalSuccess, setModalSuccess] = useState(false);
  const [resolvedMachineId, setResolvedMachineId] = useState(initialMachineId || "");
  const [cloudBaseUrl, setCloudBaseUrl] = useState<string | null>(initialCloudBaseUrl);
  const [cloudConfigured, setCloudConfigured] = useState(false);

  const postCloudAction = useCallback(
    async (action: string, timeoutMs = CLOUD_ACTION_TIMEOUT_MS) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch("/api/sync/cloud", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          return { ok: false, status: 408, data: { error: t("cloudRequestTimeout") } };
        }
        return {
          ok: false,
          status: 500,
          data: { error: error instanceof Error ? error.message : t("cloudRequestFailed") },
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [t]
  );

  const loadCloudSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setCloudEnabled(data.cloudEnabled || false);
        if (typeof data.cloudConfigured === "boolean") {
          setCloudConfigured(data.cloudConfigured);
        }
        if (data.cloudUrl) {
          setCloudBaseUrl(data.cloudUrl);
        }
        if (data.machineId) {
          setResolvedMachineId(data.machineId);
        }
      }
    } catch (error) {
      console.log("Error loading cloud settings:", error);
    }
  }, []);

  const dispatchCloudChange = useCallback(() => {
    globalThis.dispatchEvent(new Event("cloud-status-changed"));
  }, []);

  const handleEnableCloud = async () => {
    setCloudSyncing(true);
    setModalSuccess(false);
    setSyncStep("syncing");
    try {
      const { ok, status, data } = await postCloudAction("enable");
      if (ok) {
        setSyncStep("verifying");
        await new Promise((r) => setTimeout(r, 600));
        setCloudEnabled(true);
        setSyncStep("done");
        setModalSuccess(true);
        setCloudSyncing(false);
        dispatchCloudChange();

        if (data.verified) {
          setCloudStatus({ type: "success", message: t("cloudConnectedVerified") });
        } else {
          setCloudStatus({
            type: "warning",
            message: data.verifyError
              ? t("connectedVerificationPendingWithError", { error: data.verifyError })
              : t("connectedVerificationPending"),
          });
        }

        if (data.cloudUrl) {
          setCloudBaseUrl(data.cloudUrl);
        }
        await loadCloudSettings();
      } else {
        let errorMessage = data.error || t("failedEnable");
        if (status === 502 || status === 408) {
          errorMessage = t("cloudWorkerUnreachable");
        }
        setCloudStatus({ type: "error", message: errorMessage });
      }
    } catch (error: unknown) {
      setCloudStatus({
        type: "error",
        message: error instanceof Error ? error.message : t("connectionFailed"),
      });
    } finally {
      setCloudSyncing(false);
      setSyncStep("");
    }
  };

  const handleConfirmDisable = async () => {
    setCloudSyncing(true);
    setSyncStep("syncing");
    try {
      await postCloudAction("sync");
      setSyncStep("disabling");
      const { ok, data } = await postCloudAction("disable");
      if (ok) {
        setCloudEnabled(false);
        setCloudStatus({ type: "success", message: t("cloudDisabledSuccess") });
        dispatchCloudChange();
        await loadCloudSettings();
      } else {
        setCloudStatus({ type: "error", message: data.error || t("failedDisable") });
      }
    } catch (error) {
      console.log("Error disabling cloud:", error);
      setCloudStatus({ type: "error", message: t("failedDisable") });
    } finally {
      setCloudSyncing(false);
      setSyncStep("");
    }
  };

  useEffect(() => {
    if (cloudStatus) {
      const timer = setTimeout(() => setCloudStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [cloudStatus]);

  return {
    cloudEnabled,
    cloudSyncing,
    cloudStatus,
    syncStep,
    modalSuccess,
    resolvedMachineId,
    cloudBaseUrl,
    cloudConfigured,
    loadCloudSettings,
    handleEnableCloud,
    handleConfirmDisable,
    setCloudStatus,
    setModalSuccess,
  };
}
