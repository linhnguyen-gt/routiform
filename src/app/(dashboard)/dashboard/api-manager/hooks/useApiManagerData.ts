"use client";

import { useCallback, useEffect, useState } from "react";

import type { ApiKeyFull, KeyUsageStats, Model, ProviderConnectionRef } from "../types";
import { useApiMutations } from "./useApiMutations";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface ApiManagerData {
  keys: ApiKeyFull[];
  allModels: Model[];
  allConnections: ProviderConnectionRef[];
  usageStats: Record<string, KeyUsageStats>;
  sessionCounts: Record<string, number>;
  allowKeyReveal: boolean;
  loading: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
  clearError: () => void;
  toggleKeyReveal: () => void;
  refreshData: () => void;
  createKey: (name: string) => Promise<{ success: boolean; key?: string; error?: string }>;
  deleteKey: (id: string) => Promise<{ success: boolean; error?: string }>;
  updatePermissions: (
    keyId: string,
    params: {
      allowedModels: string[];
      noLog: boolean;
      allowedConnections: string[];
      autoResolve: boolean;
      isActive: boolean;
      maxSessions: number;
      accessSchedule: import("../types").AccessSchedule | null;
    }
  ) => Promise<{ success: boolean; error?: string }>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useApiManagerData(): ApiManagerData {
  const [keys, setKeys] = useState<ApiKeyFull[]>([]);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [allConnections, setAllConnections] = useState<ProviderConnectionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<Record<string, KeyUsageStats>>({});
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [allowKeyReveal, setAllowKeyReveal] = useState(false);

  const clearError = useCallback(() => setError(null), []);
  const toggleKeyReveal = useCallback(() => setAllowKeyReveal((prev) => !prev), []);

  // -- Fetch helpers --------------------------------------------------------

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/v1/models");
      if (res.ok) {
        const data = await res.json();
        setAllModels(data.data || []);
      }
    } catch (err) {
      console.log("Error fetching models:", err);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        setAllConnections(data.connections || []);
      }
    } catch (err) {
      console.log("Error fetching connections:", err);
    }
  }, []);

  const fetchUsageStats = useCallback(async (apiKeys: ApiKeyFull[]) => {
    if (apiKeys.length === 0) return;
    try {
      // Fetch accurate totals from analytics and only the most recent logs for lastUsed.
      // call-logs?limit=100 is enough because logs are returned DESC — we only need the first
      // match per key. Using /api/usage/analytics for totalRequests avoids the limit=1000 cap.
      const [analyticsRes, logsRes] = await Promise.all([
        fetch("/api/usage/analytics"),
        fetch("/api/usage/call-logs?limit=100"),
      ]);

      const analyticsData = analyticsRes.ok ? await analyticsRes.json() : {};
      const callLogs = logsRes.ok ? await logsRes.json() : [];

      // byApiKey is an array of { apiKeyName, requests, ... }
      const byApiKey: Array<{ apiKeyName?: string; requests?: number }> = Array.isArray(
        analyticsData?.byApiKey
      )
        ? analyticsData.byApiKey
        : [];

      const logList: Array<{ apiKeyName?: string; timestamp?: string }> = Array.isArray(callLogs)
        ? callLogs
        : [];

      const stats: Record<string, KeyUsageStats> = {};
      for (const key of apiKeys) {
        const analyticsEntry = byApiKey.find((u) => u.apiKeyName === key.name);
        const lastLog = logList.find((log) => log.apiKeyName === key.name);
        stats[key.id] = {
          totalRequests: analyticsEntry?.requests ?? 0,
          lastUsed: lastLog?.timestamp ?? null,
        };
      }
      setUsageStats(stats);
    } catch (err) {
      console.log("Error fetching usage stats:", err);
    }
  }, []);

  const fetchSessionCounts = useCallback(async (apiKeys: ApiKeyFull[]) => {
    if (apiKeys.length === 0) {
      setSessionCounts({});
      return;
    }
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) return;
      const data = await res.json();
      const byApiKeyRaw =
        data && typeof data.byApiKey === "object" && !Array.isArray(data.byApiKey)
          ? data.byApiKey
          : {};
      const normalized: Record<string, number> = {};
      for (const key of apiKeys) {
        const value = byApiKeyRaw[key.id];
        normalized[key.id] =
          typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
      }
      setSessionCounts(normalized);
    } catch (err) {
      console.log("Error fetching session counts:", err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setAllowKeyReveal(data.allowKeyReveal === true);
        fetchUsageStats(data.keys || []);
        fetchSessionCounts(data.keys || []);
      }
    } catch (err) {
      console.log("Error fetching keys:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchUsageStats, fetchSessionCounts]);

  useEffect(() => {
    fetchData();
    fetchModels();
    fetchConnections();
  }, [fetchData, fetchModels, fetchConnections]);

  // -- Mutation helpers (delegated) ------------------------------------------

  const { createKey, deleteKey, updatePermissions } = useApiMutations({
    setError,
    setKeys,
    fetchData,
  });

  return {
    keys,
    allModels,
    allConnections,
    usageStats,
    sessionCounts,
    allowKeyReveal,
    loading,
    error,
    setError,
    clearError,
    toggleKeyReveal,
    refreshData: fetchData,
    createKey,
    deleteKey,
    updatePermissions,
  };
}
