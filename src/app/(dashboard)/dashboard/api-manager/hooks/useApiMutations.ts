"use client";

import { useCallback } from "react";

import type { AccessSchedule, ApiKeyFull } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MutationDeps {
  setError: (msg: string | null) => void;
  setKeys: React.Dispatch<React.SetStateAction<ApiKeyFull[]>>;
  fetchData: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Provides mutation methods for API key operations (create, delete, updatePermissions).
 * Extracted from useApiManagerData to keep that hook focused on data fetching + state.
 */
export function useApiMutations(deps: MutationDeps) {
  const { setError, setKeys, fetchData } = deps;

  const createKey = useCallback(
    async (name: string): Promise<{ success: boolean; key?: string; error?: string }> => {
      setError(null);
      try {
        const res = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();

        if (res.ok) {
          await fetchData();
          return { success: true, key: data.key };
        } else {
          const errorMsg = data.error || "Failed to create key";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
      } catch (err) {
        const errorMsg = "Failed to create key. Please try again.";
        console.error("Error creating key:", err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [fetchData, setError]
  );

  const deleteKey = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        const errorMsg = "Invalid key ID";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setError(null);
      try {
        const res = await fetch(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (res.ok) {
          setKeys((prev) => prev.filter((k) => k.id !== id));
          return { success: true };
        } else {
          const data = await res.json();
          const errorMsg = data.error || "Failed to delete key";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
      } catch (err) {
        const errorMsg = "Failed to delete key. Please try again.";
        console.error("Error deleting key:", err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [setError, setKeys]
  );

  const updatePermissions = useCallback(
    async (
      keyId: string,
      params: {
        allowedModels: string[];
        noLog: boolean;
        allowedConnections: string[];
        autoResolve: boolean;
        isActive: boolean;
        maxSessions: number;
        accessSchedule: AccessSchedule | null;
      }
    ): Promise<{ success: boolean; error?: string }> => {
      if (!keyId) return { success: false, error: "Invalid key ID" };

      // Validate models array
      if (!Array.isArray(params.allowedModels)) {
        const errorMsg = "Invalid models selection";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Limit number of selected models
      const MAX_SELECTED_MODELS = 500;
      if (params.allowedModels.length > MAX_SELECTED_MODELS) {
        const errorMsg = `Cannot select more than ${MAX_SELECTED_MODELS} models`;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const validModels = params.allowedModels.filter(
        (id) => typeof id === "string" && id.length > 0 && id.length < 200
      );
      const validConnections = params.allowedConnections.filter(
        (id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)
      );
      const normalizedMaxSessions =
        typeof params.maxSessions === "number" && Number.isFinite(params.maxSessions)
          ? Math.max(0, Math.floor(params.maxSessions))
          : 0;

      setError(null);
      try {
        const res = await fetch(`/api/keys/${encodeURIComponent(keyId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            allowedModels: validModels,
            allowedConnections: validConnections,
            noLog: params.noLog,
            autoResolve: params.autoResolve,
            isActive: params.isActive,
            maxSessions: normalizedMaxSessions,
            accessSchedule: params.accessSchedule,
          }),
        });

        if (res.ok) {
          await fetchData();
          return { success: true };
        } else {
          const data = await res.json();
          const errorMsg = data.error || "Failed to update permissions";
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
      } catch (err) {
        const errorMsg = "Failed to update permissions. Please try again.";
        console.error("Error updating permissions:", err);
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [fetchData, setError]
  );

  return { createKey, deleteKey, updatePermissions };
}
