import { useCallback } from "react";
import type { ProviderDetailActionProps } from "../types/actions";

export function useProviderDetailSyncActions({
  providerId,
  supportsAutoSync,
  isLiveCatalogProvider,
  fetchProviderModelMeta,
  setOpencodeLiveCatalog,
  notify,
  t,
  setTogglingAutoSync,
  setRefreshingModels,
  setClearingModels,
  togglingAutoSync,
  refreshingModels,
  clearingModels,
}: Pick<
  ProviderDetailActionProps,
  | "providerId"
  | "supportsAutoSync"
  | "isLiveCatalogProvider"
  | "fetchProviderModelMeta"
  | "setOpencodeLiveCatalog"
  | "notify"
  | "t"
> & {
  setTogglingAutoSync: (val: boolean) => void;
  setRefreshingModels: (val: boolean) => void;
  setClearingModels: (val: boolean) => void;
  togglingAutoSync: boolean;
  refreshingModels: boolean;
  clearingModels: boolean;
}) {
  const handleToggleAutoSync = useCallback(
    async (autoSyncConnection: any, isAutoSyncEnabled: boolean) => {
      if (!autoSyncConnection || togglingAutoSync || !supportsAutoSync) return;
      setTogglingAutoSync(true);
      try {
        const newValue = !isAutoSyncEnabled;
        const existingPsd =
          autoSyncConnection.providerSpecificData &&
          typeof autoSyncConnection.providerSpecificData === "object"
            ? autoSyncConnection.providerSpecificData
            : {};
        await fetch(`/api/providers/${autoSyncConnection.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerSpecificData: { ...existingPsd, autoSync: newValue },
          }),
        });
        notify[newValue ? "success" : "info"](
          newValue ? t("autoSyncEnabled") : t("autoSyncDisabled")
        );
      } catch (error) {
        console.log("Error toggling auto-sync:", error);
        notify.error(t("autoSyncToggleFailed"));
      } finally {
        setTogglingAutoSync(false);
      }
    },
    [supportsAutoSync, togglingAutoSync, notify, t, setTogglingAutoSync]
  );

  const handleRefreshModels = useCallback(
    async (autoSyncConnection: any) => {
      if (!autoSyncConnection || refreshingModels || !supportsAutoSync) return;
      setRefreshingModels(true);
      try {
        if (isLiveCatalogProvider) {
          const res = await fetch(
            `/api/providers/${encodeURIComponent(autoSyncConnection.id)}/models`,
            { cache: "no-store" }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
          }
          const raw = Array.isArray(data.models) ? data.models : [];
          const normalized = raw
            .map((m: any) => {
              const id = String(m.id ?? m.name ?? "").trim();
              if (!id) return null;
              const name = String(m.name ?? m.displayName ?? m.id ?? "").trim() || id;
              const row: any = { id, name };
              if (typeof m.context_length === "number") row.contextLength = m.context_length;
              if (typeof m.inputTokenLimit === "number") row.contextLength = m.inputTokenLimit;
              return row;
            })
            .filter((x: any) => x !== null);
          setOpencodeLiveCatalog({ status: "ready", models: normalized, errorMessage: "" });
        } else {
          const res = await fetch(
            `/api/providers/${encodeURIComponent(autoSyncConnection.id)}/sync-models`,
            {
              method: "POST",
              signal: AbortSignal.timeout(30_000),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
          }
        }
        await fetchProviderModelMeta();
        notify.success("Models refreshed");
      } catch (error) {
        console.log("Error refreshing models:", error);
        notify.error(error instanceof Error ? error.message : t("failedFetchModels"));
      } finally {
        setRefreshingModels(false);
      }
    },
    [
      isLiveCatalogProvider,
      supportsAutoSync,
      refreshingModels,
      fetchProviderModelMeta,
      setOpencodeLiveCatalog,
      notify,
      t,
      setRefreshingModels,
    ]
  );

  const handleClearAllModels = useCallback(
    async (
      providerStorageAlias: string,
      providerAliasEntries: [string, any][],
      fetchAliases: () => Promise<void>
    ) => {
      if (clearingModels) return;
      if (!confirm(t("clearAllModelsConfirm"))) return;
      setClearingModels(true);
      try {
        const res = await fetch(
          `/api/provider-models?provider=${encodeURIComponent(providerStorageAlias)}&all=true`,
          { method: "DELETE" }
        );
        if (res.ok) {
          await Promise.all(
            providerAliasEntries.map(([alias]) =>
              fetch(`/api/models/alias?alias=${encodeURIComponent(alias)}`, {
                method: "DELETE",
              }).catch(() => {})
            )
          );
          await fetchProviderModelMeta();
          await fetchAliases();
          notify.success(t("clearAllModelsSuccess"));
        } else {
          notify.error(t("clearAllModelsFailed"));
        }
      } catch {
        notify.error(t("clearAllModelsFailed"));
      } finally {
        setClearingModels(false);
      }
    },
    [clearingModels, fetchProviderModelMeta, notify, t, setClearingModels]
  );

  return { handleToggleAutoSync, handleRefreshModels, handleClearAllModels };
}
