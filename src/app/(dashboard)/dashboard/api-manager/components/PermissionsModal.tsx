"use client";

import { Button, Modal } from "@/shared/components";
import { useTranslations } from "next-intl";
import { memo, useCallback } from "react";

import type { ApiKeyFull, Model, ProviderConnectionRef, ProviderGroup } from "../types";
import { usePermissionsState } from "../hooks/usePermissionsState";
import { PermissionsConnectionsSection } from "./PermissionsConnectionsSection";
import { PermissionsModelSelectionList } from "./PermissionsModelSelectionList";
import { PermissionsModelSummary } from "./PermissionsModelSummary";
import { PermissionsSettingsSection } from "./PermissionsSettingsSection";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKeyFull;
  modelsByProvider: ProviderGroup[];
  allModels: Model[];
  allConnections: ProviderConnectionRef[];
  searchModel: string;
  onSearchChange: (v: string) => void;
  onSave: (
    models: string[],
    noLog: boolean,
    connections: string[],
    autoResolve: boolean,
    isActive: boolean,
    maxSessions: number,
    accessSchedule: import("../types").AccessSchedule | null
  ) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PermissionsModal = memo(function PermissionsModal({
  isOpen,
  onClose,
  apiKey,
  modelsByProvider,
  allModels,
  allConnections,
  searchModel,
  onSearchChange,
  onSave,
}: PermissionsModalProps) {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");

  const state = usePermissionsState(apiKey, modelsByProvider, allModels);

  const handleSave = useCallback(() => {
    onSave(...(Object.values(state.buildSavePayload()) as Parameters<typeof onSave>));
  }, [onSave, state]);

  return (
    <Modal
      isOpen={onClose ? isOpen : false}
      title={t("permissionsTitle", { name: apiKey?.name || "" })}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {/* Access Mode Toggle */}
        <div className="flex gap-2 p-1 bg-surface rounded-lg">
          <button
            onClick={state.handleSelectAll}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              state.allowAll
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock_open</span>
            {t("allowAll")}
          </button>
          <button
            onClick={state.handleRestrictMode}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              !state.allowAll
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            {t("restrict")}
          </button>
        </div>

        {/* Info Banner */}
        <div
          className={`flex items-start gap-2 p-3 rounded-lg ${
            state.allowAll
              ? "bg-green-500/10 border border-green-500/30"
              : "bg-amber-500/10 border border-amber-500/30"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              state.allowAll ? "text-green-500" : "text-amber-500"
            }`}
          >
            {state.allowAll ? "info" : "warning"}
          </span>
          <p
            className={`text-xs ${
              state.allowAll
                ? "text-green-700 dark:text-green-300"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {state.allowAll
              ? t("allowAllDesc")
              : t("restrictDesc", {
                  selectedCount: state.selectedCount,
                  totalModels: allModels.length,
                })}
          </p>
        </div>

        {/* Settings: active, sessions, schedule, no-log, auto-resolve */}
        <PermissionsSettingsSection state={state} />

        {/* Selected Models Summary (only in restrict mode) */}
        {!state.allowAll && (
          <PermissionsModelSummary
            selectedModels={state.selectedModels}
            selectedCount={state.selectedCount}
            onToggleModel={state.handleToggleModel}
            onSelectAllModels={state.handleSelectAllModels}
            onDeselectAllModels={state.handleDeselectAllModels}
          />
        )}

        {/* Search and Model Selection (only in restrict mode) */}
        {!state.allowAll && (
          <PermissionsModelSelectionList
            modelsByProvider={modelsByProvider}
            selectedModels={state.selectedModels}
            expandedProviders={state.expandedProviders}
            searchModel={searchModel}
            onSearchChange={onSearchChange}
            onToggleModel={state.handleToggleModel}
            onToggleProvider={state.handleToggleProvider}
            onToggleExpand={state.handleToggleExpand}
          />
        )}

        {/* Allowed Connections Section */}
        <PermissionsConnectionsSection
          connections={allConnections}
          selectedConnections={state.selectedConnections}
          allowAllConnections={state.allowAllConnections}
          onToggleConnection={state.handleToggleConnection}
          onSetAllowAllConnections={state.setAllowAllConnections}
          onSetSelectedConnections={state.setSelectedConnections}
        />

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave} fullWidth>
            {t("savePermissions")}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            {tc("cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
});

export default PermissionsModal;
