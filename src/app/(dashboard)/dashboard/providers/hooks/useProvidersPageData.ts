import { useState, useEffect, useCallback } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { useTranslations } from "next-intl";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { FREE_PROVIDERS, isClaudeCodeCompatibleProvider } from "@/shared/constants/providers";
import {
  buildMergedApiKeyProviderEntries,
  buildMergedOAuthProviderEntries,
  filterConfiguredProviderEntries,
  type ProviderEntry,
  type ProviderStatsSnapshot,
} from "../providerPageUtils";
import {
  readConfiguredOnlyPreference,
  writeConfiguredOnlyPreference,
} from "../providerPageStorage";
import { calculateProviderStats } from "../provider-page-helpers.tsx";
import type {
  Connection,
  ProviderNode,
  ExpirationData,
  TestResults,
  CompatibleProviderInfo,
} from "../types";

export function useProvidersPageData() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providerNodes, setProviderNodes] = useState<ProviderNode[]>([]);
  const [ccCompatibleProviderEnabled, setCcCompatibleProviderEnabled] = useState(false);
  const [expirations, setExpirations] = useState<ExpirationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingMode, setTestingMode] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [importingZed, setImportingZed] = useState(false);
  const [showConfiguredOnly, setShowConfiguredOnly] = useState(false);
  const [configuredOnlyPreferenceReady, setConfiguredOnlyPreferenceReady] = useState(false);

  const notify = useNotificationStore();
  const t = useTranslations("providers");

  // Load configured-only preference from localStorage
  useEffect(() => {
    setShowConfiguredOnly(readConfiguredOnlyPreference());
    setConfiguredOnlyPreferenceReady(true);
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [connectionsRes, nodesRes, expirationsRes] = await Promise.all([
          fetch("/api/providers"),
          fetch("/api/provider-nodes"),
          fetch("/api/providers/expiration"),
        ]);
        const connectionsData = await connectionsRes.json();
        const nodesData = await nodesRes.json();
        const expirationsData = await expirationsRes.json();
        if (connectionsRes.ok) setConnections(connectionsData.connections || []);
        if (nodesRes.ok) {
          setProviderNodes(nodesData.nodes || []);
          setCcCompatibleProviderEnabled(nodesData.ccCompatibleProviderEnabled === true);
        }
        if (expirationsRes.ok && expirationsData) setExpirations(expirationsData);
      } catch (error) {
        console.log("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Persist configured-only preference to localStorage
  useEffect(() => {
    if (!configuredOnlyPreferenceReady) return;
    writeConfiguredOnlyPreference(showConfiguredOnly);
  }, [configuredOnlyPreferenceReady, showConfiguredOnly]);

  // Calculate provider stats - returns ProviderStats which is compatible with ProviderStatsSnapshot
  const getProviderStats = useCallback(
    (providerId: string, authType: "oauth" | "free" | "apikey") => {
      return calculateProviderStats(connections, providerId, authType, expirations);
    },
    [connections, expirations]
  );

  // Toggle all connections for a provider on/off
  const handleToggleProvider = useCallback(
    async (providerId: string, authType: string, newActive: boolean) => {
      const providerConns = connections.filter((c) => {
        if (c.provider !== providerId) return false;
        if (authType === "free") return true;
        return c.authType === authType;
      });
      // Optimistically update UI
      setConnections((prev) =>
        prev.map((c) =>
          c.provider === providerId && (authType === "free" || c.authType === authType)
            ? { ...c, isActive: newActive }
            : c
        )
      );
      // Fire API calls in parallel
      await Promise.allSettled(
        providerConns.map((c) =>
          fetch(`/api/providers/${c.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: newActive }),
          })
        )
      );
    },
    [connections]
  );

  // Batch test providers
  const handleBatchTest = useCallback(
    async (mode: string, providerId: string | null = null) => {
      if (testingMode) return;
      setTestingMode(mode === "provider" ? providerId : mode);
      setTestResults(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000); // 90s max
      try {
        const res = await fetch("/api/providers/test-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, providerId }),
          signal: controller.signal,
        });
        let data: TestResults;
        try {
          data = await res.json();
        } catch {
          // Response body is not valid JSON (e.g. truncated due to timeout)
          data = { error: t("providerTestFailed"), results: [], summary: null };
        }
        setTestResults({
          ...data,
          // Normalize error: if API returns an error object { message, details }, extract the string
          error: data.error
            ? typeof data.error === "object"
              ? data.error.message || data.error.error || JSON.stringify(data.error)
              : String(data.error)
            : null,
        });
        if (data?.summary) {
          const { passed, failed, total } = data.summary;
          if (failed === 0) notify.success(t("allTestsPassed", { total }));
          else notify.warning(t("testSummary", { passed, failed, total }));
        }
      } catch (error: unknown) {
        const isAbort = (error as Error)?.name === "AbortError";
        const msg = isAbort ? t("providerTestTimeout") : t("providerTestFailed");
        setTestResults({ error: msg, results: [], summary: null });
        notify.error(msg);
      } finally {
        clearTimeout(timeoutId);
        setTestingMode(null);
      }
    },
    [testingMode, t, notify]
  );

  // Import credentials from Zed IDE
  const handleZedImport = useCallback(async () => {
    setImportingZed(true);
    try {
      const res = await fetch("/api/providers/zed/import", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.count > 0) {
          notify.success(
            `Imported ${data.count} credentials from Zed IDE (${data.providers.join(", ")}).`
          );
          // Refresh connections silently
          const connectionsRes = await fetch("/api/providers");
          const connectionsData = await connectionsRes.json();
          if (connectionsRes.ok) setConnections(connectionsData.connections || []);
        } else {
          notify.info("No supported OAuth credentials found in Zed IDE.");
        }
      } else {
        notify.error(data.error || "Failed to import from Zed IDE.");
      }
    } catch (_error) {
      notify.error("Network error while trying to import from Zed.");
    } finally {
      setImportingZed(false);
    }
  }, [notify]);

  // Build compatible provider lists
  const compatibleProviders: CompatibleProviderInfo[] = providerNodes
    .filter((node) => node.type === "openai-compatible")
    .map((node) => ({
      id: node.id,
      name: node.name || t("openaiCompatibleName"),
      color: "#10A37F",
      textIcon: "OC",
      apiType: node.apiType,
    }));

  const anthropicCompatibleProviders: CompatibleProviderInfo[] = providerNodes
    .filter(
      (node) => node.type === "anthropic-compatible" && !isClaudeCodeCompatibleProvider(node.id)
    )
    .map((node) => ({
      id: node.id,
      name: node.name || t("anthropicCompatibleName"),
      color: "#D97757",
      textIcon: "AC",
    }));

  const ccCompatibleProviders: CompatibleProviderInfo[] = providerNodes
    .filter(
      (node) => node.type === "anthropic-compatible" && isClaudeCodeCompatibleProvider(node.id)
    )
    .map((node) => ({
      id: node.id,
      name: node.name || "CC Compatible",
      color: "#B45309",
      textIcon: "CC",
    }));

  // Build provider entries for each section
  const oauthProviderEntries: ProviderEntry[] = filterConfiguredProviderEntries(
    buildMergedOAuthProviderEntries(OAUTH_PROVIDERS, FREE_PROVIDERS, getProviderStats as any),
    showConfiguredOnly
  );

  const apiKeyProviderEntries: ProviderEntry[] = filterConfiguredProviderEntries(
    buildMergedApiKeyProviderEntries(APIKEY_PROVIDERS, FREE_PROVIDERS, getProviderStats as any),
    showConfiguredOnly
  );

  const compatibleProviderEntries: ProviderEntry<CompatibleProviderInfo>[] =
    filterConfiguredProviderEntries(
      [
        ...compatibleProviders.map(
          (provider): ProviderEntry<CompatibleProviderInfo> => ({
            providerId: provider.id,
            provider,
            stats: getProviderStats(provider.id, "apikey") as any,
            displayAuthType: "compatible" as const,
            toggleAuthType: "apikey" as const,
          })
        ),
        ...anthropicCompatibleProviders.map(
          (provider): ProviderEntry<CompatibleProviderInfo> => ({
            providerId: provider.id,
            provider,
            stats: getProviderStats(provider.id, "apikey") as any,
            displayAuthType: "compatible" as const,
            toggleAuthType: "apikey" as const,
          })
        ),
        ...ccCompatibleProviders.map(
          (provider): ProviderEntry<CompatibleProviderInfo> => ({
            providerId: provider.id,
            provider,
            stats: getProviderStats(provider.id, "apikey") as any,
            displayAuthType: "compatible" as const,
            toggleAuthType: "apikey" as const,
          })
        ),
      ],
      showConfiguredOnly
    );

  return {
    // State
    connections,
    providerNodes,
    ccCompatibleProviderEnabled,
    expirations,
    loading,
    testingMode,
    testResults,
    importingZed,
    showConfiguredOnly,

    // Computed
    compatibleProviders,
    anthropicCompatibleProviders,
    ccCompatibleProviders,
    oauthProviderEntries,
    apiKeyProviderEntries,
    compatibleProviderEntries,

    // Actions
    setProviderNodes,
    setTestResults,
    setShowConfiguredOnly,
    handleToggleProvider,
    handleBatchTest,
    handleZedImport,
  };
}
