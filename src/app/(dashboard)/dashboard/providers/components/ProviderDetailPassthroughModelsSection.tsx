"use client";

import { Button } from "@/shared/components";
import type { PassthroughModelsSectionProps } from "../[id]/types";
import { PassthroughModelRow } from "./ProviderDetailPassthroughModelRow";
import { useState } from "react";

export function PassthroughModelsSection({
  providerAlias,
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

  const allModels = providerAliases.map(([alias, fullModel]: [string, string]) => {
    const fmStr = fullModel;
    const prefix = `${providerAlias}/`;
    return {
      modelId: fmStr.startsWith(prefix) ? fmStr.slice(prefix.length) : fmStr,
      fullModel,
      alias,
    };
  });

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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{t("openRouterAnyModelHint")}</p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="new-model-input" className="text-xs text-text-muted mb-1 block">
            {t("modelIdFromOpenRouter")}
          </label>
          <input
            id="new-model-input"
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={t("openRouterModelPlaceholder")}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
          {adding ? t("adding") : t("add")}
        </Button>
      </div>
      {allModels.length > 0 && (
        <div className="flex flex-col gap-3">
          {allModels.map(({ modelId, fullModel, alias }) => {
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
  );
}
