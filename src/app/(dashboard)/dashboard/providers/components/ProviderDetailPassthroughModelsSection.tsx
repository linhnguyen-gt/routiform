"use client";

import { Button } from "@/shared/components";
import type { PassthroughModelsSectionProps } from "../[id]/types";
import { PassthroughModelRow } from "./ProviderDetailPassthroughModelRow";
import { useState } from "react";

export function PassthroughModelsSection({
  providerAlias,
  models = [],
  modelAliases,
  copied,
  onCopy,
  onSetAlias,
  onDeleteAlias,
  t,
  effectiveModelNormalize,
  effectiveModelPreserveDeveloper,
  getUpstreamHeadersRecord,
  saveModelCompatFlags,
  compatSavingModelId,
  modelTestResults = {},
  testingModelKey = null,
  onTestModel,
  canTestModels = false,
}: PassthroughModelsSectionProps) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);

  const providerAliases = Object.entries(modelAliases).filter(([, model]: [string, string]) =>
    model.startsWith(`${providerAlias}/`)
  );

  // Synced models from API
  const syncedModels = models.map((m: { id: string; name?: string }) => ({
    modelId: m.id,
    fullModel: `${providerAlias}/${m.id}`,
    alias: m.name || m.id,
    isManual: false,
  }));

  console.log("[DEBUG PassthroughModelsSection]", {
    providerAlias,
    modelsLength: models.length,
    syncedModelsLength: syncedModels.length,
  });

  // Manual models from aliases (not in synced models)
  const syncedModelIds = new Set(syncedModels.map((m) => m.modelId));
  const manualModels = providerAliases
    .map(([alias, fullModel]: [string, string]) => {
      const fmStr = fullModel;
      const prefix = `${providerAlias}/`;
      const modelId = fmStr.startsWith(prefix) ? fmStr.slice(prefix.length) : fmStr;
      return {
        modelId,
        fullModel,
        alias,
        isManual: true,
      };
    })
    .filter((m) => !syncedModelIds.has(m.modelId));

  const generateDefaultAlias = (modelId: string) => {
    const parts = modelId.split("/");
    return parts[parts.length - 1];
  };

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();
    const defaultAlias = generateDefaultAlias(modelId);
    if (modelAliases[defaultAlias]) {
      alert(t("aliasExistsAlert", { alias: defaultAlias }));
      return;
    }
    setAdding(true);
    try {
      await onSetAlias(modelId, defaultAlias);
      setNewModel("");
    } catch (error) {
      console.log("Error adding model:", error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {syncedModels.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium">Available Models</h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {syncedModels.map(({ modelId, fullModel }) => {
              const fm = fullModel as string;
              return (
                <PassthroughModelRow
                  key={fm}
                  modelId={modelId}
                  fullModel={fm}
                  copied={copied}
                  onCopy={onCopy}
                  onDeleteAlias={() => {}}
                  t={t}
                  showDeveloperToggle
                  effectiveModelNormalize={effectiveModelNormalize}
                  effectiveModelPreserveDeveloper={effectiveModelPreserveDeveloper}
                  getUpstreamHeadersRecord={(p) => getUpstreamHeadersRecord(modelId, p)}
                  saveModelCompatFlags={saveModelCompatFlags}
                  compatDisabled={compatSavingModelId === modelId}
                  testStatus={modelTestResults[fm]}
                  onTest={canTestModels && onTestModel ? () => onTestModel(fm) : undefined}
                  isTesting={testingModelKey === fm}
                />
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium">Custom Models</h3>
        <p className="mb-3 text-sm text-text-muted">{t("openRouterAnyModelHint")}</p>
        <div className="mb-4 flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="new-model-input" className="mb-1 block text-xs text-text-muted">
              {t("modelIdFromOpenRouter")}
            </label>
            <input
              id="new-model-input"
              type="text"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={t("openRouterModelPlaceholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
            {adding ? t("adding") : t("add")}
          </Button>
        </div>
        {manualModels.length > 0 && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {manualModels.map(({ modelId, fullModel, alias }) => {
              const fm = fullModel as string;
              return (
                <PassthroughModelRow
                  key={fm}
                  modelId={modelId}
                  fullModel={fm}
                  copied={copied}
                  onCopy={onCopy}
                  onDeleteAlias={() => onDeleteAlias(alias)}
                  t={t}
                  showDeveloperToggle
                  effectiveModelNormalize={effectiveModelNormalize}
                  effectiveModelPreserveDeveloper={effectiveModelPreserveDeveloper}
                  getUpstreamHeadersRecord={(p) => getUpstreamHeadersRecord(modelId, p)}
                  saveModelCompatFlags={saveModelCompatFlags}
                  compatDisabled={compatSavingModelId === modelId}
                  testStatus={modelTestResults[fm]}
                  onTest={canTestModels && onTestModel ? () => onTestModel(fm) : undefined}
                  isTesting={testingModelKey === fm}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
