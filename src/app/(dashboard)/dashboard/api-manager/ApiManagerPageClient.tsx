"use client";

import { CardSkeleton } from "@/shared/components";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { sanitizeInput, validateKeyName } from "./api-key-validation";
import { AddKeyModal } from "./components/AddKeyModal";
import { ApiManagerErrorBanner } from "./components/ApiManagerErrorBanner";
import { ApiManagerHeroHeader } from "./components/ApiManagerHeroHeader";
import { ApiManagerStatsCards } from "./components/ApiManagerStatsCards";
import { ApiManagerUsageTips } from "./components/ApiManagerUsageTips";
import { ApiKeyTable } from "./components/ApiKeyTable";
import { CreatedKeyModal } from "./components/CreatedKeyModal";
import PermissionsModal from "./components/PermissionsModal";
import { useApiManagerData } from "./hooks/useApiManagerData";
import { useKeyActions } from "./hooks/useKeyActions";
import { useModelsByProvider } from "./hooks/useModelsByProvider";
import type { AccessSchedule, ApiKeyFull } from "./types";

// ---------------------------------------------------------------------------
// Main page orchestrator
// ---------------------------------------------------------------------------

export default function ApiManagerPageClient() {
  const t = useTranslations("apiManager");

  const data = useApiManagerData();
  const { copied, copy, copyExistingKey } = useKeyActions();

  // Local UI state not owned by the data hook
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<ApiKeyFull | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [searchModel, setSearchModel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced search for performance
  const debouncedSearchModel = useDebouncedValue(searchModel, 150);

  // Group and filter models by provider (for PermissionsModal)
  const { filteredModelsByProvider } = useModelsByProvider(data.allModels, debouncedSearchModel);

  // -- Handlers --------------------------------------------------------------

  const handleCreateKey = useCallback(async () => {
    const sanitizedName = sanitizeInput(newKeyName);
    const validation = validateKeyName(sanitizedName, t);
    if (!validation.valid) {
      data.setError(validation.error || t("invalidKeyName"));
      return;
    }

    setIsSubmitting(true);
    const result = await data.createKey(sanitizedName);
    setIsSubmitting(false);

    if (result.success && result.key) {
      setCreatedKey(result.key);
      setNewKeyName("");
      setShowAddModal(false);
    }
  }, [newKeyName, t, data]);

  const handleDeleteKey = useCallback(
    async (id: string) => {
      if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) return;
      if (!confirm(t("deleteConfirm"))) return;

      setIsSubmitting(true);
      await data.deleteKey(id);
      setIsSubmitting(false);
    },
    [t, data]
  );

  const handleOpenPermissions = useCallback((key: ApiKeyFull) => {
    if (!key || !key.id) return;
    setEditingKey(key);
    setShowPermissionsModal(true);
  }, []);

  const handleUpdatePermissions = useCallback(
    async (
      allowedModels: string[],
      noLog: boolean,
      allowedConnections: string[],
      autoResolve: boolean,
      isActive: boolean,
      maxSessions: number,
      accessSchedule: AccessSchedule | null
    ) => {
      if (!editingKey || !editingKey.id) return;
      setIsSubmitting(true);
      const result = await data.updatePermissions(editingKey.id, {
        allowedModels,
        noLog,
        allowedConnections,
        autoResolve,
        isActive,
        maxSessions,
        accessSchedule,
      });
      setIsSubmitting(false);

      if (result.success) {
        setShowPermissionsModal(false);
        setEditingKey(null);
      }
    },
    [editingKey, data]
  );

  // -- Render ---------------------------------------------------------------

  if (data.loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <ApiManagerHeroHeader
        allowKeyReveal={data.allowKeyReveal}
        onToggleKeyReveal={data.toggleKeyReveal}
        onCreateKey={() => setShowAddModal(true)}
      />

      <ApiManagerErrorBanner error={data.error} onDismiss={data.clearError} />

      {data.keys.length > 0 && (
        <ApiManagerStatsCards
          keys={data.keys}
          usageStats={data.usageStats}
          allModels={data.allModels}
        />
      )}

      <ApiKeyTable
        keys={data.keys}
        usageStats={data.usageStats}
        sessionCounts={data.sessionCounts}
        allowKeyReveal={data.allowKeyReveal}
        copied={copied}
        onOpenPermissions={handleOpenPermissions}
        onDeleteKey={handleDeleteKey}
        onCopyExistingKey={copyExistingKey}
      />

      <ApiManagerUsageTips />

      <AddKeyModal
        isOpen={showAddModal}
        newKeyName={newKeyName}
        onKeyNameChange={setNewKeyName}
        isSubmitting={isSubmitting}
        onClose={() => {
          setShowAddModal(false);
          setNewKeyName("");
        }}
        onCreate={handleCreateKey}
      />

      <CreatedKeyModal
        createdKey={createdKey}
        copied={copied}
        onCopy={copy}
        onClose={() => setCreatedKey(null)}
      />

      {editingKey && (
        <PermissionsModal
          key={editingKey.id}
          isOpen={showPermissionsModal}
          onClose={() => {
            setShowPermissionsModal(false);
            setEditingKey(null);
          }}
          apiKey={editingKey}
          modelsByProvider={filteredModelsByProvider}
          allModels={data.allModels}
          allConnections={data.allConnections}
          searchModel={searchModel}
          onSearchChange={setSearchModel}
          onSave={handleUpdatePermissions}
        />
      )}
    </div>
  );
}
