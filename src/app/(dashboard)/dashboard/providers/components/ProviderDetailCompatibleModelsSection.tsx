"use client";

import { Button } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { resolveManagedModelAlias } from "@/shared/utils/providerModelAliases";
import { useCallback, useMemo, useState } from "react";
import { PassthroughModelRow } from "./ProviderDetailPassthroughModelRow";
import type { CompatibleModelsSectionProps } from "../[id]/types";

export function CompatibleModelsSection({
  providerStorageAlias,
  providerDisplayAlias,
  modelAliases,
  fallbackModels = [],
  description,
  inputLabel,
  inputPlaceholder,
  copied,
  onCopy,
  onSetAlias,
  onDeleteAlias,
  connections: _connections,
  isAnthropic,
  t,
  effectiveModelNormalize,
  effectiveModelPreserveDeveloper,
  getUpstreamHeadersRecord,
  saveModelCompatFlags,
  compatSavingModelId,
  onModelsChanged,
  modelTestResults = {},
  testingModelKey = null,
  onTestModel,
  canTestModels = false,
}: CompatibleModelsSectionProps) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);
  const notify = useNotificationStore();

  const providerAliases = useMemo(
    () =>
      Object.entries(modelAliases).filter(([, model]: [string, string]) =>
        model.startsWith(`${providerStorageAlias}/`)
      ),
    [modelAliases, providerStorageAlias]
  );

  const allModels = useMemo(() => {
    const rows = providerAliases.map(([alias, fullModel]: [string, string]) => {
      const fmStr = fullModel;
      const prefix = `${providerStorageAlias}/`;
      return {
        modelId: fmStr.startsWith(prefix) ? fmStr.slice(prefix.length) : fmStr,
        alias,
      };
    });

    const seenModelIds = new Set(rows.map((row) => row.modelId));
    for (const model of fallbackModels) {
      if (!model?.id || seenModelIds.has(model.id)) continue;
      rows.push({ modelId: model.id, alias: null });
      seenModelIds.add(model.id);
    }

    return rows;
  }, [fallbackModels, providerAliases, providerStorageAlias]);

  const resolveAlias = useCallback(
    (modelId: string, workingAliases: Record<string, string>) =>
      resolveManagedModelAlias({
        modelId,
        fullModel: `${providerStorageAlias}/${modelId}`,
        providerDisplayAlias,
        existingAliases: workingAliases,
      }),
    [providerDisplayAlias, providerStorageAlias]
  );

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();
    const resolvedAlias = resolveAlias(modelId, modelAliases);
    if (!resolvedAlias) {
      notify.error(t("allSuggestedAliasesExist"));
      return;
    }

    setAdding(true);
    try {
      const customModelRes = await fetch("/api/provider-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerStorageAlias,
          modelId,
          modelName: modelId,
          source: "manual",
        }),
      });

      if (!customModelRes.ok) {
        let errorData: { error?: { message?: string } } = {};
        try {
          errorData = await customModelRes.json();
        } catch (jsonError) {
          console.error("Failed to parse error response:", jsonError);
        }
        throw new Error(errorData.error?.message || t("failedSaveCustomModel"));
      }

      await onSetAlias(modelId, resolvedAlias, providerStorageAlias);
      setNewModel("");
      notify.success(t("modelAddedSuccess", { modelId }));
      onModelsChanged?.();
    } catch (error) {
      console.error("Error adding model:", error);
      notify.error(error instanceof Error ? error.message : t("failedAddModelTryAgain"));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteModel = async (modelId: string, alias?: string | null) => {
    try {
      const res = await fetch(
        `/api/provider-models?provider=${encodeURIComponent(providerStorageAlias)}&model=${encodeURIComponent(modelId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(t("failedRemoveModelFromDatabase"));
      if (alias) await onDeleteAlias(alias);
      notify.success(t("modelRemovedSuccess"));
      onModelsChanged?.();
    } catch (error) {
      console.error("Error deleting model:", error);
      notify.error(error instanceof Error ? error.message : t("failedDeleteModelTryAgain"));
    }
  };

  const modelsList =
    allModels.length > 0 ? (
      <div className="flex flex-col gap-3">
        {allModels.map(({ modelId, alias }) => {
          const fullModel = `${providerDisplayAlias}/${modelId}`;
          return (
            <PassthroughModelRow
              key={`${providerStorageAlias}:${modelId}`}
              modelId={modelId}
              fullModel={fullModel}
              copied={copied}
              onCopy={onCopy}
              onDeleteAlias={() => handleDeleteModel(modelId, alias)}
              t={t}
              showDeveloperToggle={!isAnthropic}
              effectiveModelNormalize={effectiveModelNormalize}
              effectiveModelPreserveDeveloper={effectiveModelPreserveDeveloper}
              getUpstreamHeadersRecord={(p) => getUpstreamHeadersRecord(modelId, p)}
              saveModelCompatFlags={saveModelCompatFlags}
              compatDisabled={compatSavingModelId === modelId}
              testStatus={modelTestResults[fullModel]}
              onTest={canTestModels && onTestModel ? () => onTestModel(fullModel) : undefined}
              isTesting={testingModelKey === fullModel}
            />
          );
        })}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {providerStorageAlias === "openrouter" && modelsList}

      <p className="text-sm text-text-muted">{description}</p>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <label
            htmlFor="new-compatible-model-input"
            className="text-xs text-text-muted mb-1 block"
          >
            {inputLabel}
          </label>
          <input
            id="new-compatible-model-input"
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={inputPlaceholder}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
          {adding ? t("adding") : t("add")}
        </Button>
      </div>

      {providerStorageAlias !== "openrouter" && modelsList}
    </div>
  );
}
