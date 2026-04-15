"use client";

import { useCallback, useState } from "react";

import type { ApiKeyFull, Model, ProviderGroup } from "../types";
import type { PermissionsState } from "./use-permissions-state-types";

export type { PermissionsState } from "./use-permissions-state-types";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePermissionsState(
  apiKey: ApiKeyFull,
  modelsByProvider: ProviderGroup[],
  allModels: Model[]
): PermissionsState {
  // Initialize state from props - component remounts when key prop changes
  const initialModels = Array.isArray(apiKey?.allowedModels) ? apiKey.allowedModels : [];
  const initialConnections = Array.isArray(apiKey?.allowedConnections)
    ? apiKey.allowedConnections
    : [];

  const [selectedModels, setSelectedModels] = useState<string[]>(initialModels);
  const [allowAll, setAllowAll] = useState(initialModels.length === 0);
  const [noLogEnabled, setNoLogEnabled] = useState(apiKey?.noLog === true);
  const [autoResolveEnabled, setAutoResolveEnabled] = useState(apiKey?.autoResolve === true);
  const [keyIsActive, setKeyIsActive] = useState(apiKey?.isActive !== false);
  const [maxSessions, setMaxSessions] = useState(
    typeof apiKey?.maxSessions === "number" && apiKey.maxSessions > 0 ? apiKey.maxSessions : 0
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(apiKey?.accessSchedule?.enabled === true);
  const [scheduleFrom, setScheduleFrom] = useState(apiKey?.accessSchedule?.from ?? "08:00");
  const [scheduleUntil, setScheduleUntil] = useState(apiKey?.accessSchedule?.until ?? "18:00");
  const [scheduleDays, setScheduleDays] = useState<number[]>(
    apiKey?.accessSchedule?.days ?? [1, 2, 3, 4, 5]
  );
  const [scheduleTz, setScheduleTz] = useState(
    apiKey?.accessSchedule?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [selectedConnections, setSelectedConnections] = useState<string[]>(initialConnections);
  const [allowAllConnections, setAllowAllConnections] = useState(initialConnections.length === 0);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(() => {
    if (initialModels.length > 0) {
      return new Set(modelsByProvider.map(([p]) => p));
    }
    return new Set();
  });

  // -- Model callbacks --------------------------------------------------------

  const handleToggleModel = useCallback(
    (modelId: string) => {
      if (allowAll) return;
      setSelectedModels((prev) =>
        prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]
      );
    },
    [allowAll]
  );

  const handleToggleProvider = useCallback(
    (provider: string, models: Model[]) => {
      if (allowAll) return;
      const modelIds = models.map((m) => m.id);
      setSelectedModels((prev) => {
        const allSelected = modelIds.every((id) => prev.includes(id));
        if (allSelected) {
          return prev.filter((m) => !modelIds.includes(m));
        }
        return [...new Set([...prev, ...modelIds])];
      });
    },
    [allowAll]
  );

  const handleSelectAll = useCallback(() => {
    setAllowAll(true);
    setSelectedModels([]);
  }, []);

  const handleRestrictMode = useCallback(() => {
    setAllowAll(false);
    const allProviders = new Set(modelsByProvider.map(([p]) => p));
    setExpandedProviders(allProviders);
  }, [modelsByProvider]);

  const handleToggleExpand = useCallback((provider: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }, []);

  const handleSelectAllModels = useCallback(() => {
    setSelectedModels(allModels.map((m) => m.id));
  }, [allModels]);

  const handleDeselectAllModels = useCallback(() => {
    setSelectedModels([]);
  }, []);

  // -- Connection callbacks --------------------------------------------------

  const handleToggleConnection = useCallback(
    (connectionId: string) => {
      if (allowAllConnections) return;
      setSelectedConnections((prev) =>
        prev.includes(connectionId)
          ? prev.filter((c) => c !== connectionId)
          : [...prev, connectionId]
      );
    },
    [allowAllConnections]
  );

  // -- Save payload builder --------------------------------------------------

  const buildSavePayload =
    useCallback((): PermissionsState["buildSavePayload"] extends () => infer R ? R : never => {
      const schedule = scheduleEnabled
        ? {
            enabled: true,
            from: scheduleFrom,
            until: scheduleUntil,
            days: scheduleDays,
            tz: scheduleTz,
          }
        : null;
      return {
        allowedModels: allowAll ? [] : selectedModels,
        noLog: noLogEnabled,
        allowedConnections: allowAllConnections ? [] : selectedConnections,
        autoResolve: autoResolveEnabled,
        isActive: keyIsActive,
        maxSessions,
        accessSchedule: schedule,
      };
    }, [
      allowAll,
      selectedModels,
      noLogEnabled,
      allowAllConnections,
      selectedConnections,
      autoResolveEnabled,
      keyIsActive,
      maxSessions,
      scheduleEnabled,
      scheduleFrom,
      scheduleUntil,
      scheduleDays,
      scheduleTz,
    ]);

  return {
    selectedModels,
    allowAll,
    handleToggleModel,
    handleToggleProvider,
    handleSelectAll,
    handleRestrictMode,
    handleSelectAllModels,
    handleDeselectAllModels,
    selectedConnections,
    allowAllConnections,
    handleToggleConnection,
    setAllowAllConnections,
    setSelectedConnections,
    noLogEnabled,
    setNoLogEnabled,
    autoResolveEnabled,
    setAutoResolveEnabled,
    keyIsActive,
    setKeyIsActive,
    maxSessions,
    setMaxSessions,
    scheduleEnabled,
    setScheduleEnabled,
    scheduleFrom,
    setScheduleFrom,
    scheduleUntil,
    setScheduleUntil,
    scheduleDays,
    setScheduleDays,
    scheduleTz,
    setScheduleTz,
    expandedProviders,
    handleToggleExpand,
    selectedCount: selectedModels.length,
    buildSavePayload,
  };
}
