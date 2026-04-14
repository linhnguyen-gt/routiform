import { useCallback } from "react";
import type { ProviderDetailActionProps } from "../types/actions";

export function useProviderDetailTokenActions({
  fetchConnections,
  notify,
  t,
  setRefreshingId,
  refreshingId,
}: Pick<ProviderDetailActionProps, "fetchConnections" | "notify" | "t"> & {
  setRefreshingId: (id: string | null) => void;
  refreshingId: string | null;
}) {
  const handleRefreshToken = useCallback(
    async (connectionId: string) => {
      if (refreshingId) return;
      setRefreshingId(connectionId);
      try {
        const res = await fetch(`/api/providers/${connectionId}/refresh`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          notify.success(t("tokenRefreshed"));
          await fetchConnections();
        } else {
          notify.error(data.error || t("tokenRefreshFailed"));
        }
      } catch (error) {
        console.error("Error refreshing token:", error);
        notify.error(t("tokenRefreshFailed"));
      } finally {
        setRefreshingId(null);
      }
    },
    [refreshingId, fetchConnections, notify, t, setRefreshingId]
  );

  return { handleRefreshToken };
}
