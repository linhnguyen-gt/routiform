import { useCallback } from "react";
import type { ProviderDetailActionProps } from "../types/actions";
import { normalizeCodexLimitPolicy } from "../../providerDetailCompatViewUtils";

export function useProviderDetailCodexActions({
  connections,
  setConnections,
  notify,
  setApplyingCodexAuthId,
  setExportingCodexAuthId,
  applyingCodexAuthId,
  exportingCodexAuthId,
}: Pick<ProviderDetailActionProps, "connections" | "setConnections" | "notify"> & {
  setApplyingCodexAuthId: (id: string | null) => void;
  setExportingCodexAuthId: (id: string | null) => void;
  applyingCodexAuthId: string | null;
  exportingCodexAuthId: string | null;
}) {
  const handleToggleCodexLimit = useCallback(
    async (connectionId: string, field: string, enabled: boolean) => {
      try {
        const target = connections.find((connection) => connection.id === connectionId);
        if (!target) return;

        const providerSpecificData =
          target.providerSpecificData && typeof target.providerSpecificData === "object"
            ? (target.providerSpecificData as Record<string, unknown>)
            : {};
        const existingPolicy =
          providerSpecificData.codexLimitPolicy &&
          typeof providerSpecificData.codexLimitPolicy === "object"
            ? (providerSpecificData.codexLimitPolicy as Record<string, unknown>)
            : {};

        const nextPolicy = {
          ...normalizeCodexLimitPolicy(existingPolicy),
          [field]: enabled,
        };

        const res = await fetch(`/api/providers/${connectionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerSpecificData: {
              ...providerSpecificData,
              codexLimitPolicy: nextPolicy,
            },
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          notify.error(data.error || "Failed to update Codex limit policy");
          return;
        }

        setConnections(
          (prev: Array<{ id: string; providerSpecificData?: Record<string, unknown> }>) =>
            prev.map((connection) =>
              connection.id === connectionId
                ? {
                    ...connection,
                    providerSpecificData: {
                      ...(connection.providerSpecificData || {}),
                      codexLimitPolicy: nextPolicy,
                    },
                  }
                : connection
            )
        );
        notify.success("Codex limit policy updated");
      } catch (error) {
        console.error("Error toggling Codex quota policy:", error);
        notify.error("Failed to update Codex limit policy");
      }
    },
    [connections, setConnections, notify]
  );

  const handleApplyCodexAuthLocal = useCallback(
    async (connectionId: string) => {
      if (applyingCodexAuthId) return;
      setApplyingCodexAuthId(connectionId);
      const defaultError = "Failed to apply Codex auth.json locally";

      try {
        const res = await fetch(`/api/providers/${connectionId}/codex-auth/apply-local`, {
          method: "POST",
        });

        if (!res.ok) {
          notify.error(defaultError);
          return;
        }

        notify.success("Codex auth.json applied locally");
      } catch (error) {
        console.error("Error applying Codex auth locally:", error);
        notify.error(defaultError);
      } finally {
        setApplyingCodexAuthId(null);
      }
    },
    [applyingCodexAuthId, setApplyingCodexAuthId, notify]
  );

  const handleExportCodexAuthFile = useCallback(
    async (connectionId: string) => {
      if (exportingCodexAuthId) return;
      setExportingCodexAuthId(connectionId);
      const defaultError = "Failed to export Codex auth.json";

      try {
        const res = await fetch(`/api/providers/${connectionId}/codex-auth/export`, {
          method: "POST",
        });

        if (!res.ok) {
          notify.error(defaultError);
          return;
        }

        const blob = await res.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "codex-auth.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);

        notify.success("Codex auth.json exported");
      } catch (error) {
        console.error("Error exporting Codex auth file:", error);
        notify.error(defaultError);
      } finally {
        setExportingCodexAuthId(null);
      }
    },
    [exportingCodexAuthId, setExportingCodexAuthId, notify]
  );

  return { handleToggleCodexLimit, handleApplyCodexAuthLocal, handleExportCodexAuthFile };
}
