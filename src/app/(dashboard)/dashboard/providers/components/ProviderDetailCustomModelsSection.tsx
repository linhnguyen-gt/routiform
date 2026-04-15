"use client";

import { Button } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { useNotificationStore } from "@/store/notificationStore";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModelCompatPopover } from "./ModelCompatPopover";
import { PassthroughModelRow as _PassthroughModelRow } from "./ProviderDetailPassthroughModelRow";
import { formatProviderModelsErrorResponse } from "../providerDetailApiUtils";
import {
  anyNoPreserveCompatBadge,
  anyNormalizeCompatBadge,
  anyUpstreamHeadersBadge,
  buildCompatMap,
  effectiveNormalizeForProtocol,
  effectivePreserveForProtocol,
  effectiveUpstreamHeadersForProtocol,
} from "../providerDetailCompatUtils";
import type { CompatModelRow, CustomModelsSectionProps, ModelCompatSavePatch } from "../[id]/types";

export function CustomModelsSection({
  providerId,
  providerAlias,
  copied,
  onCopy,
  onModelsChanged,
  onTestModel,
  modelTestResults = {},
  testingModelKey = null,
  canTestModels = false,
}: CustomModelsSectionProps) {
  const t = useTranslations("providers");
  const notify = useNotificationStore();
  const [customModels, setCustomModels] = useState<CompatModelRow[]>([]);
  const [modelCompatOverrides, setModelCompatOverrides] = useState<
    Array<CompatModelRow & { id: string }>
  >([]);
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newApiFormat, setNewApiFormat] = useState("chat-completions");
  const [newEndpoints, setNewEndpoints] = useState(["chat"]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingApiFormat, setEditingApiFormat] = useState("chat-completions");
  const [editingEndpoints, setEditingEndpoints] = useState<string[]>(["chat"]);
  const [savingModelId, setSavingModelId] = useState<string | null>(null);

  const customMap = useMemo(() => buildCompatMap(customModels), [customModels]);
  const overrideMap = useMemo(() => buildCompatMap(modelCompatOverrides), [modelCompatOverrides]);

  const endpointOptionMeta: Record<string, { icon: string; label: string }> = {
    chat: { icon: "chat", label: "Chat" },
    embeddings: { icon: "data_array", label: "Embeddings" },
    images: { icon: "image", label: "Images" },
    audio: { icon: "graphic_eq", label: "Audio" },
  };

  const pendingAddFullModel = newModelId.trim() ? `${providerAlias}/${newModelId.trim()}` : "";

  const fetchCustomModels = useCallback(async () => {
    try {
      const res = await fetch(`/api/provider-models?provider=${encodeURIComponent(providerId)}`);
      if (res.ok) {
        const data = await res.json();
        const manualModels = Array.isArray(data.models)
          ? data.models.filter(
              (model: { source?: string }) => (model?.source || "manual") === "manual"
            )
          : [];
        setCustomModels(manualModels);
        setModelCompatOverrides(data.modelCompatOverrides || []);
      }
    } catch (e) {
      console.error("Failed to fetch custom models:", e);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchCustomModels();
  }, [fetchCustomModels]);

  const handleAdd = async () => {
    if (!newModelId.trim() || adding) return;
    const modelIdTrim = newModelId.trim();
    const fullModelForProbe = `${providerAlias}/${modelIdTrim}`;
    setAdding(true);
    try {
      if (newEndpoints.includes("chat")) {
        if (!canTestModels || !onTestModel) {
          notify.error(t("addConnectionToImport"));
          return;
        }
        const probeOk = await onTestModel(fullModelForProbe);
        if (!probeOk) return;
      }
      const res = await fetch("/api/provider-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          modelId: modelIdTrim,
          modelName: newModelName.trim() || undefined,
          apiFormat: newApiFormat,
          supportedEndpoints: newEndpoints,
        }),
      });
      if (res.ok) {
        await fetchCustomModels();
        onModelsChanged?.();
        notify.success(t("modelAddedSuccess", { modelId: modelIdTrim }));
        setNewModelId("");
        setNewModelName("");
        setNewApiFormat("chat-completions");
        setNewEndpoints(["chat"]);
      } else {
        const detail = await formatProviderModelsErrorResponse(res);
        notify.error(detail || t("failedAddModelTryAgain"));
      }
    } catch (e) {
      console.error("Failed to add custom model:", e);
      notify.error(t("failedAddModelTryAgain"));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (modelId: string) => {
    try {
      await fetch(
        `/api/provider-models?provider=${encodeURIComponent(providerId)}&model=${encodeURIComponent(modelId)}`,
        { method: "DELETE" }
      );
      await fetchCustomModels();
      onModelsChanged?.();
    } catch (e) {
      console.error("Failed to remove custom model:", e);
    }
  };

  const beginEdit = (model: CompatModelRow) => {
    setEditingModelId(model.id);
    setEditingApiFormat(model.apiFormat || "chat-completions");
    setEditingEndpoints(
      Array.isArray(model.supportedEndpoints) && model.supportedEndpoints.length
        ? model.supportedEndpoints
        : ["chat"]
    );
  };

  const cancelEdit = () => {
    setEditingModelId(null);
    setEditingApiFormat("chat-completions");
    setEditingEndpoints(["chat"]);
    setSavingModelId(null);
  };

  const saveCustomCompat = async (
    modelId: string,
    patch: Pick<ModelCompatSavePatch, "compatByProtocol">
  ) => {
    setSavingModelId(modelId);
    try {
      const res = await fetch("/api/provider-models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, modelId, ...patch }),
      });
      if (!res.ok) {
        const detail = await formatProviderModelsErrorResponse(res);
        notify.error(
          detail ? `${t("failedSaveCustomModel")} — ${detail}` : t("failedSaveCustomModel")
        );
        return;
      }
    } catch {
      notify.error(t("failedSaveCustomModel"));
      return;
    } finally {
      setSavingModelId(null);
    }
    try {
      await fetchCustomModels();
      onModelsChanged?.();
    } catch {
      /* refresh failure is non-critical */
    }
  };

  const saveEdit = async (modelId: string) => {
    if (!editingModelId || editingModelId !== modelId) return;
    if (!editingEndpoints.length) {
      notify.error("Select at least one supported endpoint");
      return;
    }
    setSavingModelId(modelId);
    try {
      const model = customModels.find((m) => m.id === modelId);
      const res = await fetch("/api/provider-models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          modelId,
          modelName: model?.name || modelId,
          source: model?.source || "manual",
          apiFormat: editingApiFormat,
          supportedEndpoints: editingEndpoints,
        }),
      });
      if (!res.ok) {
        const detail = await formatProviderModelsErrorResponse(res);
        throw new Error(detail || "Failed to save model endpoint settings");
      }
      await fetchCustomModels();
      onModelsChanged?.();
      notify.success("Saved model endpoint settings");
      cancelEdit();
    } catch (e) {
      console.error("Failed to save custom model:", e);
      notify.error(
        e instanceof Error && e.message ? e.message : "Failed to save model endpoint settings"
      );
    } finally {
      setSavingModelId(null);
    }
  };

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="material-symbols-outlined text-xl text-primary" aria-hidden>
            tune
          </span>
          {t("customModels")}
        </h3>
        <p className="mt-1 text-sm text-text-muted">{t("customModelsHint")}</p>
      </div>

      <div className="mb-5 rounded-xl border border-border/60 bg-bg-subtle/30 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
            <div className="min-w-0">
              <label
                htmlFor="custom-model-id"
                className="mb-1.5 block text-xs font-medium text-text-muted"
              >
                {t("modelId")}
              </label>
              <input
                id="custom-model-id"
                type="text"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("customModelPlaceholder")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor="custom-model-name"
                className="mb-1.5 block text-xs font-medium text-text-muted"
              >
                {t("displayName")}
              </label>
              <input
                id="custom-model-name"
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("optional")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              API &amp; routing
            </p>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,13rem)_1fr] lg:items-start">
              <div className="min-w-0">
                <label
                  htmlFor="custom-api-format"
                  className="mb-1.5 block text-xs font-medium text-text-muted"
                >
                  API Format
                </label>
                <select
                  id="custom-api-format"
                  value={newApiFormat}
                  onChange={(e) => setNewApiFormat(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="chat-completions">Chat Completions</option>
                  <option value="responses">Responses API</option>
                </select>
              </div>
              <div className="min-w-0">
                <span className="mb-2 block text-xs font-medium text-text-muted">
                  Supported Endpoints
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {["chat", "embeddings", "images", "audio"].map((ep) => {
                    const meta = endpointOptionMeta[ep];
                    const checked = newEndpoints.includes(ep);
                    return (
                      <label
                        key={ep}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                          checked
                            ? "border-primary/35 bg-primary/10"
                            : "border-border/60 bg-background/80 hover:border-border"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewEndpoints((prev) => [...prev, ep]);
                            } else {
                              setNewEndpoints((prev) => prev.filter((x) => x !== ep));
                            }
                          }}
                          className="rounded border-border"
                        />
                        <span
                          className="material-symbols-outlined text-base text-text-muted"
                          aria-hidden
                        >
                          {meta.icon}
                        </span>
                        <span className="text-xs font-medium text-text-main">{meta.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-border/40 pt-4">
            <Button
              size="sm"
              icon="add"
              onClick={handleAdd}
              disabled={!newModelId.trim() || adding}
              className="w-full min-w-[10rem] sm:w-auto"
            >
              {adding && testingModelKey === pendingAddFullModel
                ? t("testingModel")
                : adding
                  ? t("adding")
                  : t("add")}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-text-muted">{t("loading")}</p>
      ) : customModels.length > 0 ? (
        <div className="flex flex-col gap-2">
          {customModels.map((model) => {
            const fullModel = `${providerAlias}/${model.id}`;
            const copyKey = `custom-${model.id}`;
            return (
              <div
                key={model.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-sidebar/50",
                  modelTestResults[fullModel] === "ok" && "border-green-500/35",
                  modelTestResults[fullModel] === "error" && "border-red-500/30",
                  !modelTestResults[fullModel] && "border-border"
                )}
              >
                {editingModelId !== model.id && (
                  <span className="material-symbols-outlined shrink-0 text-base text-primary">
                    tune
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{model.name || model.id}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <code className="text-xs text-text-muted font-mono bg-sidebar px-1.5 py-0.5 rounded">
                      {fullModel}
                    </code>
                    <button
                      onClick={() => onCopy(fullModel, copyKey)}
                      className="p-0.5 hover:bg-sidebar rounded text-text-muted hover:text-primary"
                      title={t("copyModel")}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {copied === copyKey ? "check" : "content_copy"}
                      </span>
                    </button>
                    {model.apiFormat === "responses" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                        Responses
                      </span>
                    )}
                    {model.supportedEndpoints?.includes("embeddings") && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium">
                        📐 Embed
                      </span>
                    )}
                    {anyNormalizeCompatBadge(model.id, customMap, overrideMap) && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400 font-medium"
                        title={t("normalizeToolCallIdLabel")}
                      >
                        ID×9
                      </span>
                    )}
                    {anyNoPreserveCompatBadge(model.id, customMap, overrideMap) && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium"
                        title={t("compatDoNotPreserveDeveloper")}
                      >
                        {t("compatBadgeNoPreserve")}
                      </span>
                    )}
                    {anyUpstreamHeadersBadge(model.id, customMap, overrideMap) && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium"
                        title={t("compatUpstreamHeadersLabel")}
                      >
                        {t("compatBadgeUpstreamHeaders")}
                      </span>
                    )}
                  </div>

                  {editingModelId === model.id && (
                    <div className="mt-3 min-w-0 max-w-full rounded-lg border border-border/60 bg-muted/50 p-4 dark:bg-zinc-900/80">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                        API &amp; routing
                      </p>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,13rem)_1fr] lg:items-start">
                        <div className="min-w-0">
                          <label className="mb-1.5 block text-xs font-medium text-text-muted">
                            API Format
                          </label>
                          <select
                            value={editingApiFormat}
                            onChange={(e) => setEditingApiFormat(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none"
                          >
                            <option value="chat-completions">Chat Completions</option>
                            <option value="responses">Responses API</option>
                          </select>
                        </div>
                        <div className="min-w-0">
                          <span className="mb-2 block text-xs font-medium text-text-muted">
                            Supported Endpoints
                          </span>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {["chat", "embeddings", "images", "audio"].map((ep) => {
                              const meta = endpointOptionMeta[ep];
                              const checked = editingEndpoints.includes(ep);
                              return (
                                <label
                                  key={ep}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                                    checked
                                      ? "border-primary/35 bg-primary/10"
                                      : "border-border/60 bg-background/80 hover:border-border"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setEditingEndpoints((prev) =>
                                          prev.includes(ep) ? prev : [...prev, ep]
                                        );
                                      } else {
                                        setEditingEndpoints((prev) => prev.filter((x) => x !== ep));
                                      }
                                    }}
                                    className="rounded border-border"
                                  />
                                  <span
                                    className="material-symbols-outlined text-base text-text-muted"
                                    aria-hidden
                                  >
                                    {meta.icon}
                                  </span>
                                  <span className="text-xs font-medium text-text-main">
                                    {meta.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border/40 pt-3">
                        <Button
                          size="sm"
                          onClick={() => saveEdit(model.id)}
                          disabled={savingModelId === model.id}
                        >
                          {savingModelId === model.id ? t("saving") : t("save")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          {t("cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-0.5">
                  {canTestModels && onTestModel && (
                    <button
                      type="button"
                      onClick={() => void onTestModel(fullModel)}
                      disabled={testingModelKey === fullModel}
                      className={cn(
                        "rounded-md p-1.5 text-text-muted transition-colors hover:bg-sidebar hover:text-primary",
                        modelTestResults[fullModel] === "ok" &&
                          "text-green-500 hover:text-green-400",
                        modelTestResults[fullModel] === "error" && "text-red-500 hover:text-red-400"
                      )}
                      title={testingModelKey === fullModel ? t("testingModel") : t("testModel")}
                    >
                      <span
                        className={cn(
                          "material-symbols-outlined text-lg",
                          testingModelKey === fullModel && "animate-spin"
                        )}
                      >
                        {testingModelKey === fullModel ? "progress_activity" : "science"}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => beginEdit(model)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-sidebar hover:text-primary"
                    title={t("edit")}
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <ModelCompatPopover
                    t={t}
                    effectiveModelNormalize={(p) =>
                      effectiveNormalizeForProtocol(model.id, p, customMap, overrideMap)
                    }
                    effectiveModelPreserveDeveloper={(p) =>
                      effectivePreserveForProtocol(model.id, p, customMap, overrideMap)
                    }
                    getUpstreamHeadersRecord={(p) =>
                      effectiveUpstreamHeadersForProtocol(model.id, p, customMap, overrideMap)
                    }
                    onCompatPatch={(protocol, payload) =>
                      saveCustomCompat(model.id, { compatByProtocol: { [protocol]: payload } })
                    }
                    showDeveloperToggle
                    disabled={savingModelId === model.id}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(model.id)}
                    className="rounded-md p-1.5 text-red-500 hover:bg-red-500/10"
                    title={t("removeCustomModel")}
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 bg-bg-subtle/20 py-10 text-center">
          <span
            className="material-symbols-outlined mb-2 inline-block text-3xl text-text-muted/50"
            aria-hidden
          >
            deployed_code
          </span>
          <p className="text-sm text-text-muted">{t("noCustomModels")}</p>
        </div>
      )}
    </div>
  );
}
