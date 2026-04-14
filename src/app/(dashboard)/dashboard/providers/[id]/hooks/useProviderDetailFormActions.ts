import { useCallback } from "react";
import type { ProviderDetailActionProps } from "../types/actions";

export function useProviderDetailFormActions({
  providerId,
  fetchConnections,
  handleUpdateNode,
  setShowAddApiKeyModal,
  setShowEditModal,
  selectedConnection,
  t,
}: Pick<ProviderDetailActionProps, "providerId" | "fetchConnections" | "handleUpdateNode" | "t"> & {
  setShowAddApiKeyModal: (val: boolean) => void;
  setShowEditModal: (val: boolean) => void;
  selectedConnection: Record<string, unknown> & { id: string };
}) {
  const handleSaveApiKey = useCallback(
    async (formData: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: providerId, ...formData }),
        });
        if (res.ok) {
          await fetchConnections();
          setShowAddApiKeyModal(false);
          return null;
        }
        const data = await res.json().catch(() => ({}));
        return data.error?.message || data.error || t("failedSaveConnection");
      } catch (error) {
        console.log("Error saving connection:", error);
        return t("failedSaveConnectionRetry");
      }
    },
    [providerId, fetchConnections, setShowAddApiKeyModal, t]
  );

  const handleUpdateConnection = useCallback(
    async (formData: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/providers/${selectedConnection.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          await fetchConnections();
          setShowEditModal(false);
          return null;
        }
        const data = await res.json().catch(() => ({}));
        return data.error?.message || data.error || t("failedSaveConnection");
      } catch (error) {
        console.log("Error updating connection:", error);
        return t("failedSaveConnectionRetry");
      }
    },
    [selectedConnection, fetchConnections, setShowEditModal, t]
  );

  return { handleSaveApiKey, handleUpdateConnection, handleUpdateNode };
}
