import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useNotificationStore } from "@/store/notificationStore";
import {
  getProviderAlias,
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
  isOpenAICompatibleProvider,
  supportsApiKeyOnFreeProvider,
  FREE_PROVIDERS,
  OAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
} from "@/shared/constants/providers";
import { supportsProviderModelAutoSync } from "@/shared/utils/providerAutoSync";
import { MODEL_COMPAT_PROTOCOL_KEYS } from "@/shared/constants/modelCompat";
import {
  buildCompatMap,
  effectiveNormalizeForProtocol,
  effectivePreserveForProtocol,
  effectiveUpstreamHeadersForProtocol,
} from "../../providerDetailCompatUtils";
import { getCompatibleFallbackModels } from "@/lib/providers/managedAvailableModels";

import { useProviderDetailConnections } from "./useProviderDetailConnections";
import { useProviderDetailModels } from "./useProviderDetailModels";
import { useProviderDetailAliases } from "./useProviderDetailAliases";
import { useProviderDetailModals } from "./useProviderDetailModals";
import { useProviderDetailSelection } from "./useProviderDetailSelection";
import { useProviderDetailModelActions } from "./useProviderDetailModelActions";
import { useProviderDetailConnectionActions } from "./useProviderDetailConnectionActions";
import { useProviderDetailSyncActions } from "./useProviderDetailSyncActions";
import { useProviderDetailTestActions } from "./useProviderDetailTestActions";
import { useProviderDetailTokenActions } from "./useProviderDetailTokenActions";
import { useProviderDetailPriorityActions } from "./useProviderDetailPriorityActions";
import { useProviderDetailCodexActions } from "./useProviderDetailCodexActions";
import { useProviderDetailFormActions } from "./useProviderDetailFormActions";

import { CC_COMPATIBLE_LABEL } from "../../providerDetailCompatUtils";

export function useProviderDetailOrchestrator() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;
  const t = useTranslations("providers");
  const notify = useNotificationStore();
  const { copied, copy } = useCopyToClipboard();

  // Provider type detection
  const isOpenAICompatible = isOpenAICompatibleProvider(providerId);
  const isCcCompatible = isClaudeCodeCompatibleProvider(providerId);
  const isAnthropicCompatible =
    isAnthropicCompatibleProvider(providerId) && !isClaudeCodeCompatibleProvider(providerId);
  const isCompatible = isOpenAICompatible || isAnthropicCompatible || isCcCompatible;
  const isAnthropicProtocolCompatible = isAnthropicCompatible || isCcCompatible;
  const isSearchProvider = providerId.endsWith("-search");
  const isLiveCatalogProvider =
    providerId === "opencode-zen" || providerId === "kilocode" || providerId === "codex";

  // Connections hook
  const { connections, loading, setConnections, providerNode, fetchConnections, handleUpdateNode } =
    useProviderDetailConnections({ providerId, isCompatible });

  // Sorted connection IDs
  const sortedConnectionIds = useMemo(
    () =>
      [...connections]
        .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
        .map((c: any) => c.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    [connections]
  );

  // Selection hook
  const selectAllConnectionsRef = useRef<HTMLInputElement>(null);
  const {
    selectedConnectionIds,
    setSelectedConnectionIds,
    toggleConnectionBulkSelect,
    toggleSelectAllConnections,
  } = useProviderDetailSelection({
    connections,
    sortedConnectionIds,
    selectAllRef: selectAllConnectionsRef,
  });

  // Models hook
  const {
    modelMeta,
    syncedAvailableModels,
    opencodeLiveCatalog,
    setOpencodeLiveCatalog,
    models,
    registryModels,
    syncedModels,
    fetchProviderModelMeta,
  } = useProviderDetailModels({
    providerId,
    isSearchProvider,
    isLiveCatalogProvider,
    loading,
    sortedConnectionIds,
  });

  // Aliases hook
  const providerAlias = getProviderAlias(providerId);
  const { modelAliases, fetchAliases, handleSetAlias, handleDeleteAlias } =
    useProviderDetailAliases(providerAlias, t);

  // Modals hook
  const {
    showOAuthModal,
    setShowOAuthModal,
    showAddApiKeyModal,
    setShowAddApiKeyModal,
    showEditModal,
    setShowEditModal,
    showEditNodeModal,
    setShowEditNodeModal,
    selectedConnection,
    setSelectedConnection,
    batchTestResults,
    setBatchTestResults,
  } = useProviderDetailModals();

  // Additional state
  const [retestingId, setRetestingId] = useState<string | null>(null);
  const [batchTesting, setBatchTesting] = useState(false);
  const [headerImgErrorProviderId, setHeaderImgErrorProviderId] = useState<string | null>(null);
  const [proxyTarget, setProxyTarget] = useState<any>(null);
  const [proxyConfig, setProxyConfig] = useState<any>(null);
  const [connProxyMap, setConnProxyMap] = useState<
    Record<string, { proxy: any; level: string } | null>
  >({});
  const [modelTestResults, setModelTestResults] = useState<Record<string, "ok" | "error">>({});
  const [testingModelKey, setTestingModelKey] = useState<string | null>(null);
  const [modelTestBannerError, setModelTestBannerError] = useState("");
  const modelTestInFlightRef = useRef(false);
  const [bulkDeletingConnections, setBulkDeletingConnections] = useState(false);
  const [bulkUpdatingStatus, setBulkUpdatingStatus] = useState(false);
  const [compatSavingModelId, setCompatSavingModelId] = useState<string | null>(null);
  const [applyingCodexAuthId, setApplyingCodexAuthId] = useState<string | null>(null);
  const [exportingCodexAuthId, setExportingCodexAuthId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [togglingAutoSync, setTogglingAutoSync] = useState(false);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [clearingModels, setClearingModels] = useState(false);
  const autoSyncBootstrappedRef = useRef<Set<string>>(new Set());

  // Compatibility Maps
  const customMap = useMemo(() => buildCompatMap(modelMeta.customModels), [modelMeta.customModels]);
  const overrideMap = useMemo(
    () => buildCompatMap(modelMeta.modelCompatOverrides),
    [modelMeta.modelCompatOverrides]
  );
  const compatibleFallbackModels = useMemo(
    () => getCompatibleFallbackModels(providerId, modelMeta.customModels),
    [providerId, modelMeta.customModels]
  );

  const providerAliasEntries = useMemo(
    () =>
      Object.entries(modelAliases).filter(([, model]) =>
        (model as string).startsWith(`${isCompatible ? providerId : providerAlias}/`)
      ),
    [modelAliases, isCompatible, providerId, providerAlias]
  );

  // Shared props for action hooks
  const actionProps = {
    providerId,
    providerAlias,
    providerDisplayAlias: isCompatible
      ? (providerNode as any)?.prefix || providerId
      : providerAlias,
    providerStorageAlias: isCompatible ? providerId : providerAlias,
    connections,
    modelMeta,
    customMap,
    overrideMap,
    fetchConnections,
    fetchProviderModelMeta,
    fetchAliases,
    setConnections,
    setSelectedConnectionIds,
    setOpencodeLiveCatalog,
    notify,
    t,
    isLiveCatalogProvider,
    supportsAutoSync: supportsProviderModelAutoSync(providerId),
  };

  // Actions
  const { saveModelCompatFlags } = useProviderDetailModelActions({
    ...actionProps,
    setCompatSavingModelId,
  });

  const {
    handleDelete,
    handleBulkDeleteConnections,
    handleBulkUpdateConnectionStatus,
    handleUpdateConnectionStatus,
    handleRetestConnection,
  } = useProviderDetailConnectionActions({
    ...actionProps,
    sortedConnectionIds,
    setBulkDeletingConnections,
    setBulkUpdatingStatus,
    setRetestingId,
    retestingId,
  });

  const { handleToggleAutoSync, handleRefreshModels, handleClearAllModels } =
    useProviderDetailSyncActions({
      ...actionProps,
      setTogglingAutoSync,
      setRefreshingModels,
      setClearingModels,
      togglingAutoSync,
      refreshingModels,
      clearingModels,
    });

  const { handleTestModel, handleBatchTestAll } = useProviderDetailTestActions({
    ...actionProps,
    setBatchTesting,
    setBatchTestResults,
    setTestingModelKey,
    setModelTestBannerError,
    setModelTestResults,
    batchTesting,
    retestingId,
    modelTestInFlightRef,
  });

  const { handleRefreshToken } = useProviderDetailTokenActions({
    ...actionProps,
    setRefreshingId,
    refreshingId,
  });

  const { handleSwapPriority } = useProviderDetailPriorityActions(actionProps);

  const { handleToggleCodexLimit, handleApplyCodexAuthLocal, handleExportCodexAuthFile } =
    useProviderDetailCodexActions({
      ...actionProps,
      setApplyingCodexAuthId,
      setExportingCodexAuthId,
      applyingCodexAuthId,
      exportingCodexAuthId,
    });

  const { handleSaveApiKey, handleUpdateConnection } = useProviderDetailFormActions({
    ...actionProps,
    handleUpdateNode,
    setShowAddApiKeyModal,
    setShowEditModal,
    setShowEditNodeModal,
    setSelectedConnection,
    selectedConnection,
  });

  // Effective config helpers
  const effectiveModelNormalize = useCallback(
    (modelId: string, protocol = MODEL_COMPAT_PROTOCOL_KEYS[0]) =>
      effectiveNormalizeForProtocol(modelId, protocol, customMap, overrideMap),
    [customMap, overrideMap]
  );

  const effectiveModelPreserveDeveloper = useCallback(
    (modelId: string, protocol = MODEL_COMPAT_PROTOCOL_KEYS[0]) =>
      effectivePreserveForProtocol(modelId, protocol, customMap, overrideMap),
    [customMap, overrideMap]
  );

  const getUpstreamHeadersRecordForModel = useCallback(
    (modelId: string, protocol: string) =>
      effectiveUpstreamHeadersForProtocol(modelId, protocol, customMap, overrideMap),
    [customMap, overrideMap]
  );

  // Provider info formatting
  const providerNodeObj = providerNode as Record<string, any> | null;
  const providerInfo = providerNodeObj
    ? {
        id: providerNodeObj.id,
        name:
          providerNodeObj.name ||
          (isCcCompatible
            ? CC_COMPATIBLE_LABEL
            : providerNodeObj.type === "anthropic-compatible"
              ? t("anthropicCompatibleName")
              : t("openaiCompatibleName")),
        color: isCcCompatible
          ? "#B45309"
          : providerNodeObj.type === "anthropic-compatible"
            ? "#D97757"
            : "#10A37F",
        textIcon: isCcCompatible
          ? "CC"
          : providerNodeObj.type === "anthropic-compatible"
            ? "AC"
            : "OC",
        apiType: providerNodeObj.apiType,
        baseUrl: providerNodeObj.baseUrl,
        type: providerNodeObj.type,
        website: providerNodeObj.website,
        passthroughModels: providerNodeObj.passthroughModels,
      }
    : (FREE_PROVIDERS as any)[providerId] ||
      (OAUTH_PROVIDERS as any)[providerId] ||
      (APIKEY_PROVIDERS as any)[providerId];

  const providerSupportsOAuth =
    !!(FREE_PROVIDERS as any)[providerId] || !!(OAUTH_PROVIDERS as any)[providerId];
  const providerSupportsPat = supportsApiKeyOnFreeProvider(providerId);
  const isOAuth = providerSupportsOAuth && !providerSupportsPat;
  const allowQoderOAuthUi = providerId !== "qoder";
  const isManagedAvailableModelsProvider = isCompatible || providerId === "openrouter";
  const supportsAutoSync = supportsProviderModelAutoSync(providerId);

  const headerImgError = headerImgErrorProviderId === providerId;
  const setHeaderImgError = useCallback(
    (hasError: boolean) => {
      setHeaderImgErrorProviderId(hasError ? providerId : null);
    },
    [providerId]
  );

  // Proxies
  const loadConnProxies = useCallback(async (conns: any[]) => {
    if (!conns.length) return;
    try {
      const results = await Promise.all(
        conns
          .filter((c) => c.id)
          .map((c) =>
            fetch(`/api/settings/proxy?resolve=${encodeURIComponent(c.id!)}`, { cache: "no-store" })
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => [c.id!, data] as [string, any])
              .catch(() => [c.id!, null] as [string, any])
          )
      );
      const map: Record<string, { proxy: any; level: string } | null> = {};
      for (const [id, data] of results) {
        map[id] = data?.proxy ? data : null;
      }
      setConnProxyMap(map);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch("/api/settings/proxy")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setProxyConfig(c))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && connections.length > 0) {
      const timeoutId = setTimeout(() => {
         
        void loadConnProxies(connections);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [loading, connections, loadConnProxies]);

  // Auto-sync effect
  const autoSyncConnection = connections.find((conn: any) => conn.isActive !== false);
  const isAutoSyncEnabled =
    supportsAutoSync && (autoSyncConnection as any)?.providerSpecificData?.autoSync !== false;

  useEffect(() => {
    if (loading || !supportsAutoSync || !isAutoSyncEnabled) return;
    const activeConnection = connections.find((conn: any) => conn.isActive !== false) as any;
    if (!activeConnection?.id) return;

    const bootstrapKey = String(activeConnection.id);
    if (autoSyncBootstrappedRef.current.has(bootstrapKey)) return;

    const hasSyncedModels =
      syncedModels.length > 0 ||
      (providerId === "gemini" && syncedAvailableModels.length > 0) ||
      (isLiveCatalogProvider &&
        opencodeLiveCatalog.status === "ready" &&
        opencodeLiveCatalog.models.length > 0);

    if (hasSyncedModels) {
      autoSyncBootstrappedRef.current.add(bootstrapKey);
      return;
    }

    autoSyncBootstrappedRef.current.add(bootstrapKey);
    void fetch(`/api/providers/${encodeURIComponent(bootstrapKey)}/sync-models`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
    })
      .then(() => fetchProviderModelMeta())
      .catch(() => {
        autoSyncBootstrappedRef.current.delete(bootstrapKey);
      });
  }, [
    loading,
    supportsAutoSync,
    isAutoSyncEnabled,
    connections,
    syncedModels,
    providerId,
    syncedAvailableModels,
    isLiveCatalogProvider,
    opencodeLiveCatalog,
    fetchProviderModelMeta,
  ]);

  return {
    // Context & Helpers
    providerId,
    router,
    t,
    notify,
    copied,
    copy,
    providerInfo,
    providerNode,
    providerAlias,
    providerDisplayAlias: actionProps.providerDisplayAlias,
    providerStorageAlias: actionProps.providerStorageAlias,
    isOpenAICompatible,
    isCcCompatible,
    isAnthropicCompatible,
    isCompatible,
    isAnthropicProtocolCompatible,
    isSearchProvider,
    isLiveCatalogProvider,
    isManagedAvailableModelsProvider,
    isOAuth,
    providerSupportsPat,
    allowQoderOAuthUi,
    supportsAutoSync,

    // Data
    connections,
    loading,
    sortedConnectionIds,
    modelMeta,
    syncedAvailableModels,
    opencodeLiveCatalog,
    models,
    registryModels,
    syncedModels,
    modelAliases,
    providerAliasEntries,

    // State
    selectedConnectionIds,
    setSelectedConnectionIds,
    selectAllConnectionsRef,
    showOAuthModal,
    setShowOAuthModal,
    showAddApiKeyModal,
    setShowAddApiKeyModal,
    showEditModal,
    setShowEditModal,
    showEditNodeModal,
    setShowEditNodeModal,
    selectedConnection,
    setSelectedConnection,
    batchTestResults,
    setBatchTestResults,
    retestingId,
    batchTesting,
    headerImgError,
    setHeaderImgError,
    proxyTarget,
    setProxyTarget,
    proxyConfig,
    connProxyMap,
    modelTestResults,
    testingModelKey,
    modelTestBannerError,
    bulkDeletingConnections,
    bulkUpdatingStatus,
    compatSavingModelId,
    applyingCodexAuthId,
    exportingCodexAuthId,
    refreshingId,
    togglingAutoSync,
    refreshingModels,
    clearingModels,
    isAutoSyncEnabled,
    autoSyncConnection,
    compatibleFallbackModels,

    // Actions
    fetchConnections,
    fetchProviderModelMeta,
    handleUpdateNode,
    toggleConnectionBulkSelect,
    toggleSelectAllConnections,
    handleSetAlias,
    handleDeleteAlias,
    saveModelCompatFlags,
    handleDelete,
    handleBulkDeleteConnections,
    handleBulkUpdateConnectionStatus,
    handleUpdateConnectionStatus,
    handleRetestConnection,
    handleToggleAutoSync,
    handleRefreshModels,
    handleClearAllModels,
    handleTestModel,
    handleBatchTestAll,
    handleRefreshToken,
    handleSwapPriority,
    handleToggleCodexLimit,
    handleApplyCodexAuthLocal,
    handleExportCodexAuthFile,
    handleSaveApiKey,
    handleUpdateConnection,
    loadConnProxies,
    fetchAliases,

    // Utils
    effectiveModelNormalize,
    effectiveModelPreserveDeveloper,
    getUpstreamHeadersRecordForModel,
  };
}
