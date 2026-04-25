"use client";

import { Button, Input, Modal, ModelSelectModal } from "@/shared/components";
import Tooltip from "@/shared/components/Tooltip";
import { useNotificationStore } from "@/store/notificationStore";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ADVANCED_FIELD_HELP_FALLBACK,
  COMBO_TEMPLATE_FALLBACK,
  COMBO_TEMPLATES,
  STRATEGY_OPTIONS,
  VALID_NAME_REGEX,
} from "./combo-constants";
import { ComboReadinessPanel } from "./ComboReadinessPanel";
import { getProviderDisplayName, normalizeModelEntry } from "./combo-data";
import type {
  ComboModelEntry,
  ComboRecord,
  ModelAliases,
  PricingByProvider,
  ProviderNode,
} from "./combo-types";
import { getI18nOrFallback, getStrategyDescription, getStrategyLabel } from "./combo-utils";
import { FieldLabelWithHelp } from "./FieldLabelWithHelp";
import { StrategyGuidanceCard } from "./StrategyGuidanceCard";
import { StrategyRecommendationsPanel } from "./StrategyRecommendationsPanel";
import { WeightTotalBar } from "./WeightTotalBar";

const FREE_STACK_PRESET_MODELS = [
  { model: "gemini-cli/gemini-3-flash-preview", weight: 0 },
  { model: "kr/claude-sonnet-4.5", weight: 0 },
  { model: "if/kimi-k2-thinking", weight: 0 },
  { model: "if/qwen3-coder-plus", weight: 0 },
  { model: "if/deepseek-v3.2", weight: 0 },
  { model: "nvidia/llama-3.3-70b-instruct", weight: 0 },
  { model: "groq/llama-3.3-70b-versatile", weight: 0 },
];

const PAID_PREMIUM_PRESET_MODELS = [
  { model: "cu/claude-4.6-opus-high", weight: 0 },
  { model: "antigravity/claude-sonnet-4-6", weight: 0 },
  { model: "cu/claude-4.6-sonnet-high", weight: 0 },
  { model: "antigravity/gemini-3.1-pro-high", weight: 0 },
  { model: "antigravity/gemini-3-pro-high", weight: 0 },
];

function createModelRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type ComboSaveData = Omit<ComboRecord, "id" | "isActive">;

interface ComboFormModalProps {
  isOpen: boolean;
  combo: ComboRecord | null;
  onClose: () => void;
  onSave: (data: ComboSaveData) => Promise<void>;
  activeProviders: ProviderNode[];
}

export function ComboFormModal({
  isOpen,
  combo,
  onClose,
  onSave,
  activeProviders,
}: ComboFormModalProps) {
  const t = useTranslations("combos");
  const tc = useTranslations("common");
  const notify = useNotificationStore();
  const initialFormState = useMemo(
    () => ({
      name: combo?.name || "",
      models: (combo?.models || []).map((m: string | ComboModelEntry) => normalizeModelEntry(m)),
      strategy: combo?.strategy || "priority",
      config: combo?.config || {},
      agentSystemMessage: combo?.system_message || "",
      agentToolFilter: combo?.tool_filter_regex || "",
      agentContextCache: !!combo?.context_cache_protection,
      requireToolCalling: !!combo?.requireToolCalling,
    }),
    [combo]
  );
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState<
    Array<{ model: string; weight: number; disabled?: boolean }>
  >(() => {
    return (combo?.models || []).map((m: string | ComboModelEntry) => normalizeModelEntry(m));
  });
  const [strategy, setStrategy] = useState(combo?.strategy || "priority");
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [pricingByProvider, setPricingByProvider] = useState<PricingByProvider>({});
  const [modelAliases, setModelAliases] = useState<ModelAliases>({});
  const [providerNodes, setProviderNodes] = useState<ProviderNode[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [config, setConfig] = useState<Record<string, boolean | number | string | undefined>>(
    combo?.config || {}
  );
  const [showStrategyNudge, setShowStrategyNudge] = useState(false);
  const strategyNudgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [agentSystemMessage, setAgentSystemMessage] = useState<string>(combo?.system_message || "");
  const [agentToolFilter, setAgentToolFilter] = useState<string>(combo?.tool_filter_regex || "");
  const [agentContextCache, setAgentContextCache] = useState<boolean>(
    !!combo?.context_cache_protection
  );
  const [requireToolCalling, setRequireToolCalling] = useState<boolean>(
    !!combo?.requireToolCalling
  );
  const [modelRowIds, setModelRowIds] = useState<string[]>(() =>
    (combo?.models || []).map(() => createModelRowId())
  );
  const [testingModels, setTestingModels] = useState<Record<string, boolean>>({});
  const [modelTestStatus, setModelTestStatus] = useState<Record<string, "ok" | "error">>({});
  const modelTestControllersRef = useRef<Record<string, AbortController>>({});
  const modalFetchControllerRef = useRef<AbortController | null>(null);
  const modelTestSessionRef = useRef(0);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const hasPricingForModel = useCallback(
    (modelValue: string) => {
      if (!modelValue || typeof modelValue !== "string") return false;

      const parts = modelValue.split("/");
      if (parts.length !== 2) return false;

      const [providerIdentifier, modelId] = parts;
      const matchedNode = providerNodes.find(
        (node) => node.id === providerIdentifier || node.prefix === providerIdentifier
      );

      const providerCandidates = [providerIdentifier];
      if (matchedNode?.apiType) providerCandidates.push(matchedNode.apiType);
      if (matchedNode?.name) providerCandidates.push(String(matchedNode.name).toLowerCase());

      return providerCandidates.some((candidate) => !!pricingByProvider?.[candidate]?.[modelId]);
    },
    [pricingByProvider, providerNodes]
  );

  const weightTotal = models.reduce(
    (sum, modelEntry) => sum + (modelEntry.disabled ? 0 : modelEntry.weight || 0),
    0
  );
  const activeModels = models.filter((m) => !m.disabled);
  const pricedModelCount = activeModels.reduce(
    (count, modelEntry) => count + (hasPricingForModel(modelEntry.model) ? 1 : 0),
    0
  );
  const pricingCoveragePercent =
    activeModels.length > 0 ? Math.round((pricedModelCount / activeModels.length) * 100) : 0;
  const hasNoModels = models.length === 0;
  const hasNoActiveModels = activeModels.length === 0;
  const hasRoundRobinSingleModel = strategy === "round-robin" && activeModels.length === 1;
  const hasCostOptimizedWithoutPricing =
    strategy === "cost-optimized" && activeModels.length > 0 && pricedModelCount === 0;
  const hasCostOptimizedPartialPricing =
    strategy === "cost-optimized" &&
    activeModels.length > 0 &&
    pricedModelCount > 0 &&
    pricedModelCount < activeModels.length;
  const hasInvalidWeightedTotal =
    strategy === "weighted" && activeModels.length > 0 && weightTotal !== 100;
  const saveBlocked =
    !name.trim() ||
    !!nameError ||
    saving ||
    hasNoModels ||
    hasNoActiveModels ||
    hasInvalidWeightedTotal ||
    hasCostOptimizedWithoutPricing;
  const readinessChecks = [
    {
      id: "name",
      ok: !!name.trim() && !nameError,
      label: getI18nOrFallback(t, "readinessCheckName", "Combo name is valid"),
    },
    {
      id: "models",
      ok: !hasNoModels && !hasNoActiveModels,
      label: getI18nOrFallback(t, "readinessCheckModels", "At least one model is active"),
    },
    {
      id: "weights",
      ok: strategy === "weighted" ? !hasInvalidWeightedTotal : true,
      label:
        strategy === "weighted"
          ? getI18nOrFallback(t, "readinessCheckWeights", "Weighted total is 100%")
          : getI18nOrFallback(t, "readinessCheckWeightsOptional", "Weight rule not required"),
    },
    {
      id: "pricing",
      ok: strategy === "cost-optimized" ? !hasCostOptimizedWithoutPricing : true,
      label:
        strategy === "cost-optimized"
          ? getI18nOrFallback(t, "readinessCheckPricing", "Pricing data is available")
          : getI18nOrFallback(t, "readinessCheckPricingOptional", "Pricing rule not required"),
    },
  ];
  const saveBlockers: string[] = [];
  if (!name.trim()) {
    saveBlockers.push(getI18nOrFallback(t, "saveBlockName", "Define a combo name."));
  } else if (nameError) {
    saveBlockers.push(nameError);
  }
  if (hasNoModels) {
    saveBlockers.push(getI18nOrFallback(t, "saveBlockModels", "Add at least one model."));
  }
  if (hasNoActiveModels && !hasNoModels) {
    saveBlockers.push(
      getI18nOrFallback(t, "saveBlockNoActiveModels", "Enable at least one model.")
    );
  }
  if (hasInvalidWeightedTotal) {
    saveBlockers.push(
      getI18nOrFallback(t, "saveBlockWeighted", `Set weights to 100% (current: ${weightTotal}%).`, {
        total: weightTotal,
      })
    );
  }
  if (hasCostOptimizedWithoutPricing) {
    saveBlockers.push(
      getI18nOrFallback(
        t,
        "saveBlockPricing",
        "Add pricing for at least one model or choose a different strategy."
      )
    );
  }

  const fetchModalData = async (signal: AbortSignal) => {
    try {
      const [aliasesRes, nodesRes, pricingRes] = await Promise.all([
        fetch("/api/models/alias", { signal }),
        fetch("/api/provider-nodes", { signal }),
        fetch("/api/pricing", { signal }),
      ]);

      if (!aliasesRes.ok || !nodesRes.ok) {
        throw new Error(
          `Failed to fetch data: aliases=${aliasesRes.status}, nodes=${nodesRes.status}`
        );
      }
      const pricingData = pricingRes.ok ? await pricingRes.json() : {};

      const [aliasesData, nodesData] = await Promise.all([aliasesRes.json(), nodesRes.json()]);
      if (!signal.aborted) {
        setPricingByProvider(
          pricingData && typeof pricingData === "object" && !Array.isArray(pricingData)
            ? pricingData
            : {}
        );
        setModelAliases(aliasesData.aliases || {});
        setProviderNodes(nodesData.nodes || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Error fetching modal data:", error);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      modalFetchControllerRef.current?.abort();
      modalFetchControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    modalFetchControllerRef.current = controller;
    fetchModalData(controller.signal);

    return () => {
      controller.abort();
      if (modalFetchControllerRef.current === controller) {
        modalFetchControllerRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      modelTestSessionRef.current += 1;
      for (const controller of Object.values(modelTestControllersRef.current)) {
        controller.abort();
      }
      modelTestControllersRef.current = {};
      modalFetchControllerRef.current?.abort();
      modalFetchControllerRef.current = null;
      setTestingModels({});
      return;
    }

    modelTestSessionRef.current += 1;

    setName(initialFormState.name);
    setModels(initialFormState.models);
    setModelRowIds(initialFormState.models.map(() => createModelRowId()));
    setStrategy(initialFormState.strategy);
    setConfig(initialFormState.config);
    setAgentSystemMessage(initialFormState.agentSystemMessage);
    setAgentToolFilter(initialFormState.agentToolFilter);
    setAgentContextCache(initialFormState.agentContextCache);
    setRequireToolCalling(initialFormState.requireToolCalling);

    setShowModelSelect(false);
    setSaving(false);
    setNameError("");
    setShowAdvanced(false);
    setShowStrategyNudge(false);
    setDragIndex(null);
    setDragOverIndex(null);
    setTestingModels({});
    setModelTestStatus({});
  }, [initialFormState, isOpen]);

  useEffect(
    () => () => {
      for (const controller of Object.values(modelTestControllersRef.current)) {
        controller.abort();
      }
      modelTestControllersRef.current = {};
      modalFetchControllerRef.current?.abort();
      modalFetchControllerRef.current = null;
    },
    []
  );

  const triggerStrategyNudge = useCallback(() => {
    setShowStrategyNudge(true);
    if (strategyNudgeTimeoutRef.current) {
      clearTimeout(strategyNudgeTimeoutRef.current);
    }
    strategyNudgeTimeoutRef.current = setTimeout(() => setShowStrategyNudge(false), 2600);
  }, []);

  useEffect(
    () => () => {
      if (strategyNudgeTimeoutRef.current) {
        clearTimeout(strategyNudgeTimeoutRef.current);
      }
    },
    []
  );

  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError(t("nameRequired"));
      return false;
    }
    if (!VALID_NAME_REGEX.test(value)) {
      setNameError(t("nameInvalid"));
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (value) validateName(value);
    else setNameError("");
  };

  const handleToggleModel = (model: { value: string }) => {
    const value = model.value;
    const existingIndex = models.findIndex((m) => m.model === value);
    if (existingIndex >= 0) {
      const rowId = modelRowIds[existingIndex];
      modelTestControllersRef.current[rowId]?.abort();
      delete modelTestControllersRef.current[rowId];
      setTestingModels((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
      setModelTestStatus((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
      setModels(models.filter((_, index) => index !== existingIndex));
      setModelRowIds(modelRowIds.filter((_, index) => index !== existingIndex));
    } else {
      setModels([...models, { model: value, weight: 0 }]);
      setModelRowIds([...modelRowIds, createModelRowId()]);
    }
  };

  const handleRemoveModel = (index: number) => {
    const rowId = modelRowIds[index];
    modelTestControllersRef.current[rowId]?.abort();
    delete modelTestControllersRef.current[rowId];
    setTestingModels((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setModelTestStatus((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setModels(models.filter((_, i) => i !== index));
    setModelRowIds(modelRowIds.filter((_, i) => i !== index));
  };

  const handleWeightChange = (index: number, weight: string | number) => {
    const newModels = [...models];
    newModels[index] = {
      ...newModels[index],
      weight: Math.max(0, Math.min(100, Number(weight) || 0)),
    };
    setModels(newModels);
  };

  const handleToggleDisabled = (index: number) => {
    const newModels = [...models];
    newModels[index] = {
      ...newModels[index],
      disabled: !newModels[index].disabled,
    };
    setModels(newModels);
  };
  let activeIndex = 0;

  const handleAutoBalance = () => {
    const activeModels = models.filter((m) => !m.disabled);
    const count = activeModels.length;
    if (count === 0) return;
    const weight = Math.floor(100 / count);
    const remainder = 100 - weight * count;
    setModels(
      models.map((m) => {
        if (m.disabled) return m;
        const newWeight = weight + (activeIndex === 0 ? remainder : 0);
        activeIndex++;
        return { ...m, weight: newWeight };
      })
    );
  };

  const applyStrategyRecommendations = () => {
    const strategyDefaults: Record<string, Record<string, string | number | boolean>> = {
      priority: { maxRetries: 2, retryDelayMs: 1500, healthCheckEnabled: true },
      weighted: { maxRetries: 1, retryDelayMs: 1000, healthCheckEnabled: true },
      "round-robin": {
        maxRetries: 1,
        retryDelayMs: 750,
        healthCheckEnabled: true,
        concurrencyPerModel: 3,
        queueTimeoutMs: 30000,
      },
      random: { maxRetries: 1, retryDelayMs: 1000, healthCheckEnabled: true },
      "least-used": { maxRetries: 1, retryDelayMs: 1000, healthCheckEnabled: true },
      "cost-optimized": { maxRetries: 1, retryDelayMs: 500, healthCheckEnabled: true },
    };

    const defaults = strategyDefaults[strategy] || strategyDefaults.priority;
    setConfig((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(defaults)) {
        if (next[key] === undefined || next[key] === null || next[key] === "") {
          next[key] = value;
        }
      }
      return next;
    });

    if (strategy === "weighted" && models.length > 1) {
      handleAutoBalance();
    }

    if (strategy === "round-robin") {
      setShowAdvanced(true);
    }

    notify.success(
      getI18nOrFallback(t, "recommendationsApplied", "Recommendations applied to this combo.")
    );
  };

  const applyTemplate = (template: (typeof COMBO_TEMPLATES)[number]) => {
    setStrategy(template.strategy);
    setConfig((prev) => ({ ...prev, ...template.config }));
    if (!name.trim()) setName(template.suggestedName);
    if (template.id === "free-stack") {
      setModels(FREE_STACK_PRESET_MODELS);
      setModelRowIds(FREE_STACK_PRESET_MODELS.map(() => createModelRowId()));
    } else if (template.id === "paid-premium") {
      setModels(PAID_PREMIUM_PRESET_MODELS);
      setModelRowIds(PAID_PREMIUM_PRESET_MODELS.map(() => createModelRowId()));
    }
  };

  const formatModelDisplay = useCallback(
    (modelValue: string) => getProviderDisplayName(modelValue, providerNodes),
    [providerNodes]
  );

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newModels = [...models];
    const newRowIds = [...modelRowIds];
    [newModels[index - 1], newModels[index]] = [newModels[index], newModels[index - 1]];
    [newRowIds[index - 1], newRowIds[index]] = [newRowIds[index], newRowIds[index - 1]];
    setModels(newModels);
    setModelRowIds(newRowIds);
  };

  const handleMoveDown = (index: number) => {
    if (index === models.length - 1) return;
    const newModels = [...models];
    const newRowIds = [...modelRowIds];
    [newModels[index], newModels[index + 1]] = [newModels[index + 1], newModels[index]];
    [newRowIds[index], newRowIds[index + 1]] = [newRowIds[index + 1], newRowIds[index]];
    setModels(newModels);
    setModelRowIds(newRowIds);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    const el = e.currentTarget as HTMLElement | null;
    if (el) {
      setTimeout(() => {
        if (el.isConnected) el.style.opacity = "0.5";
      }, 0);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement | null;
    if (el) el.style.opacity = "1";
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndex;
    if (fromIndex === null || fromIndex === dropIndex) return;

    const newModels = [...models];
    const newRowIds = [...modelRowIds];
    const [moved] = newModels.splice(fromIndex, 1);
    const [movedRowId] = newRowIds.splice(fromIndex, 1);
    newModels.splice(dropIndex, 0, moved);
    newRowIds.splice(dropIndex, 0, movedRowId);
    setModels(newModels);
    setModelRowIds(newRowIds);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleTestModel = async (modelValue: string, key: string) => {
    if (!modelValue) return;
    if (testingModels[key]) return;

    const requestSessionId = modelTestSessionRef.current;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);
    modelTestControllersRef.current[key]?.abort();
    modelTestControllersRef.current[key] = controller;

    setTestingModels((prev) => ({ ...prev, [key]: true }));
    setModelTestStatus((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelValue }),
        signal: controller.signal,
      });

      if (modelTestSessionRef.current !== requestSessionId) {
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        latencyMs?: number;
      };
      if (res.ok && payload.ok) {
        setModelTestStatus((prev) => ({ ...prev, [key]: "ok" }));
        notify.success(
          getI18nOrFallback(t, "modelTestSuccess", "Model test passed in {ms}ms.", {
            ms: payload.latencyMs ?? 0,
          })
        );
      } else {
        const errorMessage =
          (typeof payload.error === "string" && payload.error) ||
          (typeof payload.message === "string" && payload.message) ||
          getI18nOrFallback(t, "testFailed", "Test request failed");
        setModelTestStatus((prev) => ({ ...prev, [key]: "error" }));
        notify.error(errorMessage);
      }
    } catch (error) {
      if (modelTestSessionRef.current !== requestSessionId) {
        return;
      }
      if (error instanceof Error && error.name === "AbortError" && !timedOut) {
        return;
      }
      setModelTestStatus((prev) => ({ ...prev, [key]: "error" }));
      notify.error(getI18nOrFallback(t, "testFailed", "Test request failed"));
    } finally {
      clearTimeout(timeout);
      if (modelTestControllersRef.current[key] === controller) {
        delete modelTestControllersRef.current[key];
      }
      if (
        modelTestSessionRef.current === requestSessionId &&
        modelTestControllersRef.current[key] !== controller
      ) {
        setTestingModels((prev) => ({ ...prev, [key]: false }));
      }
    }
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    if (hasNoModels || hasInvalidWeightedTotal || hasCostOptimizedWithoutPricing) return;
    if (saving) return;
    setSaving(true);

    try {
      const saveData: ComboSaveData = {
        name: name.trim(),
        models: models.map((m) => {
          const entry: ComboModelEntry = { model: m.model };
          if (strategy === "weighted") entry.weight = m.weight;
          if (m.disabled) entry.disabled = true;
          return entry;
        }),
        strategy,
      };

      const configToSave = { ...config };
      if (strategy === "round-robin") {
        if (config.concurrencyPerModel !== undefined)
          configToSave.concurrencyPerModel = config.concurrencyPerModel;
        if (config.queueTimeoutMs !== undefined)
          configToSave.queueTimeoutMs = config.queueTimeoutMs;
      }
      if (Object.keys(configToSave).length > 0) {
        saveData.config = configToSave;
      }

      if (agentSystemMessage.trim()) saveData.system_message = agentSystemMessage.trim();
      else delete saveData.system_message;
      if (agentToolFilter.trim()) saveData.tool_filter_regex = agentToolFilter.trim();
      else delete saveData.tool_filter_regex;
      if (agentContextCache) saveData.context_cache_protection = true;
      else delete saveData.context_cache_protection;
      if (requireToolCalling) saveData.requireToolCalling = true;
      else delete saveData.requireToolCalling;

      await onSave(saveData);
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!combo;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? t("editCombo") : t("createCombo")}
        size="full"
      >
        <div className="flex flex-col gap-3">
          <div>
            <Input
              label={t("comboName")}
              value={name}
              onChange={handleNameChange}
              placeholder={t("comboNamePlaceholder")}
              error={nameError}
            />
            <p className="text-[10px] text-text-muted mt-0.5">{t("nameHint")}</p>
          </div>

          {!isEdit && (
            <div className="rounded-lg border border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] p-3">
              <div className="mb-2">
                <p className="text-xs font-medium">
                  {getI18nOrFallback(t, "templatesTitle", COMBO_TEMPLATE_FALLBACK.title)}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {getI18nOrFallback(
                    t,
                    "templatesDescription",
                    COMBO_TEMPLATE_FALLBACK.description
                  )}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {COMBO_TEMPLATES.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className={`text-left rounded-md border px-3 py-2 transition-all ${
                      template.isFeatured
                        ? "border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500/80 hover:bg-emerald-500/10 ring-1 ring-emerald-500/20"
                        : "border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`material-symbols-outlined text-[16px] ${template.isFeatured ? "text-emerald-500" : "text-primary"}`}
                      >
                        {template.icon}
                      </span>
                      <span className="text-[12px] font-semibold text-text-main">
                        {getI18nOrFallback(t, template.titleKey, template.fallbackTitle)}
                      </span>
                      {template.isFeatured && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                          FREE
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1.5 leading-[1.5]">
                      {getI18nOrFallback(t, template.descKey, template.fallbackDesc)}
                    </p>
                    <p
                      className={`text-[10px] mt-1.5 font-medium ${template.isFeatured ? "text-emerald-500" : "text-primary"}`}
                    >
                      {getI18nOrFallback(t, "templateApply", COMBO_TEMPLATE_FALLBACK.apply)} →
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <label className="text-sm font-medium">{t("routingStrategy")}</label>
              <Tooltip content={getStrategyDescription(t, strategy)}>
                <span className="material-symbols-outlined text-[13px] text-text-muted cursor-help">
                  help
                </span>
              </Tooltip>
            </div>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-black/5 dark:bg-white/5 rounded-lg">
              {STRATEGY_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    if (strategy === s.value) {
                      return;
                    }
                    setStrategy(s.value);
                    triggerStrategyNudge();
                  }}
                  data-testid={`strategy-option-${s.value}`}
                  title={getStrategyDescription(t, s.value)}
                  aria-label={`${getStrategyLabel(t, s.value)}. ${getStrategyDescription(t, s.value)}`}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                    strategy === s.value
                      ? "bg-white dark:bg-bg-main shadow-sm text-primary"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px] align-middle mr-0.5">
                    {s.icon}
                  </span>
                  {getStrategyLabel(t, s.value)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              {getStrategyDescription(t, strategy)}
            </p>
            <div className="mt-2">
              <StrategyGuidanceCard strategy={strategy} />
            </div>
            <div className="mt-2">
              <StrategyRecommendationsPanel
                strategy={strategy}
                onApply={applyStrategyRecommendations}
                showNudge={showStrategyNudge}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">{t("models")}</label>
              {strategy === "weighted" && models.length > 1 && (
                <button
                  onClick={handleAutoBalance}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  {t("autoBalance")}
                </button>
              )}
            </div>

            {models.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-black/10 dark:border-white/10 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]">
                <span className="material-symbols-outlined text-text-muted text-xl mb-1">
                  layers
                </span>
                <p className="text-xs text-text-muted">{t("noModelsYet")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
                {models.map((entry, index) => {
                  const modelTestKey = modelRowIds[index] || `${index}:${entry.model}`;
                  const isTestingModel = !!testingModels[modelTestKey];
                  const status = modelTestStatus[modelTestKey];

                  return (
                    <div
                      key={modelTestKey}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`group/item flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all cursor-grab active:cursor-grabbing ${
                        dragOverIndex === index && dragIndex !== index
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] border border-transparent"
                      } ${dragIndex === index ? "opacity-50" : ""} ${entry.disabled ? "opacity-50" : ""}`}
                    >
                      <button
                        onClick={() => handleToggleDisabled(index)}
                        className={`shrink-0 w-8 h-4 rounded-full transition-all relative ${
                          entry.disabled ? "bg-black/10 dark:bg-white/10" : "bg-primary"
                        }`}
                        title={entry.disabled ? "Enable model" : "Disable model"}
                        aria-label={entry.disabled ? "Enable model" : "Disable model"}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${
                            entry.disabled ? "left-0.5" : "left-[18px]"
                          }`}
                        />
                      </button>

                      <span className="material-symbols-outlined text-[14px] text-text-muted/40 cursor-grab shrink-0">
                        drag_indicator
                      </span>

                      <span className="text-[10px] font-medium text-text-muted w-3 text-center shrink-0">
                        {index + 1}
                      </span>

                      <div
                        className={`flex-1 min-w-0 px-1 text-xs truncate ${entry.disabled ? "text-text-muted line-through" : "text-text-main"}`}
                      >
                        {formatModelDisplay(entry.model)}
                      </div>

                      {strategy === "cost-optimized" && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-semibold ${
                            hasPricingForModel(entry.model)
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}
                          title={
                            hasPricingForModel(entry.model)
                              ? getI18nOrFallback(t, "pricingAvailable", "Pricing available")
                              : getI18nOrFallback(t, "pricingMissing", "No pricing")
                          }
                        >
                          {hasPricingForModel(entry.model)
                            ? getI18nOrFallback(t, "pricingAvailableShort", "priced")
                            : getI18nOrFallback(t, "pricingMissingShort", "no-price")}
                        </span>
                      )}

                      {strategy === "weighted" && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={entry.weight}
                            onChange={(e) => handleWeightChange(index, e.target.value)}
                            className="w-10 text-[11px] text-center py-0.5 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                          />
                          <span className="text-[10px] text-text-muted">%</span>
                        </div>
                      )}

                      {strategy === "priority" && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className={`p-0.5 rounded ${index === 0 ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
                            aria-label={t("moveUp")}
                            title={t("moveUp")}
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              arrow_upward
                            </span>
                          </button>
                          <button
                            onClick={() => handleMoveDown(index)}
                            disabled={index === models.length - 1}
                            className={`p-0.5 rounded ${index === models.length - 1 ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
                            aria-label={t("moveDown")}
                            title={t("moveDown")}
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              arrow_downward
                            </span>
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => handleTestModel(entry.model, modelTestKey)}
                        disabled={isTestingModel}
                        aria-label={
                          isTestingModel
                            ? getI18nOrFallback(t, "testingModel", "Testing model...")
                            : getI18nOrFallback(t, "testModel", "Test model")
                        }
                        className={`p-0.5 rounded transition-all ${
                          status === "ok"
                            ? "text-emerald-500 hover:bg-emerald-500/10"
                            : status === "error"
                              ? "text-red-500 hover:bg-red-500/10"
                              : "text-text-muted hover:text-emerald-500 hover:bg-black/5 dark:hover:bg-white/5"
                        } ${isTestingModel ? "cursor-not-allowed opacity-60" : ""}`}
                        title={
                          isTestingModel
                            ? getI18nOrFallback(t, "testingModel", "Testing model...")
                            : getI18nOrFallback(t, "testModel", "Test model")
                        }
                      >
                        <span
                          className={`material-symbols-outlined text-[12px] ${isTestingModel ? "animate-spin" : ""}`}
                        >
                          {isTestingModel
                            ? "progress_activity"
                            : status === "ok"
                              ? "check_circle"
                              : status === "error"
                                ? "error"
                                : "play_arrow"}
                        </span>
                      </button>

                      <button
                        onClick={() => handleRemoveModel(index)}
                        aria-label={t("removeModel")}
                        className="p-0.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-500 transition-all"
                        title={t("removeModel")}
                      >
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {strategy === "weighted" && models.length > 0 && <WeightTotalBar models={models} />}

            {strategy === "cost-optimized" && models.length > 0 && (
              <div className="mt-2 rounded-md border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-2 py-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-muted">
                    {getI18nOrFallback(t, "pricingCoverage", "Pricing coverage")}
                  </span>
                  <span className="font-medium text-text-main">
                    {pricedModelCount}/{activeModels.length} ({pricingCoveragePercent}%)
                  </span>
                </div>
                <div className="h-1.5 mt-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      pricingCoveragePercent === 100
                        ? "bg-emerald-500"
                        : pricingCoveragePercent > 0
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${pricingCoveragePercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-text-muted mt-1">
                  {getI18nOrFallback(
                    t,
                    "pricingCoverageHint",
                    "Cost-optimized works best when all combo models have pricing."
                  )}
                </p>
              </div>
            )}

            {hasNoModels && (
              <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                <span>{t("noModelsYet")}</span>
              </div>
            )}

            {hasInvalidWeightedTotal && (
              <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                <span>
                  {t("weighted")} {weightTotal}% {"≠"} 100%. {t("autoBalance")}
                </span>
              </div>
            )}

            {hasRoundRobinSingleModel && (
              <div className="mt-2 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1.5 text-[10px] text-blue-700 dark:text-blue-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">info</span>
                <span>
                  {getI18nOrFallback(
                    t,
                    "warningRoundRobinSingleModel",
                    "Round-robin is most useful with at least 2 models."
                  )}
                </span>
              </div>
            )}

            {hasCostOptimizedPartialPricing && (
              <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                <span>
                  {getI18nOrFallback(
                    t,
                    "warningCostOptimizedPartialPricing",
                    `Only ${pricedModelCount} of ${activeModels.length} models have pricing. Routing may be partially cost-aware.`,
                    { priced: pricedModelCount, total: activeModels.length }
                  )}
                </span>
              </div>
            )}

            {hasCostOptimizedWithoutPricing && (
              <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                <span>
                  {getI18nOrFallback(
                    t,
                    "warningCostOptimizedNoPricing",
                    "No pricing data found for this combo. Cost-optimized may route unexpectedly."
                  )}
                </span>
              </div>
            )}

            <div className="mt-2">
              <ComboReadinessPanel checks={readinessChecks} blockers={saveBlockers} />
            </div>

            <button
              onClick={() => setShowModelSelect(true)}
              className="w-full mt-2 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-text-muted hover:text-primary hover:border-primary/30 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t("addModel")}
            </button>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-main transition-colors self-start"
          >
            <span className="material-symbols-outlined text-[14px]">
              {showAdvanced ? "expand_less" : "expand_more"}
            </span>
            {t("advancedSettings")}
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-2 p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg border border-black/5 dark:border-white/5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabelWithHelp
                    label={t("maxRetries")}
                    help={getI18nOrFallback(
                      t,
                      "advancedHelp.maxRetries",
                      ADVANCED_FIELD_HELP_FALLBACK.maxRetries
                    )}
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={typeof config.maxRetries === "number" ? config.maxRetries : ""}
                    placeholder="1"
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        maxRetries: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <FieldLabelWithHelp
                    label={t("retryDelay")}
                    help={getI18nOrFallback(
                      t,
                      "advancedHelp.retryDelay",
                      ADVANCED_FIELD_HELP_FALLBACK.retryDelay
                    )}
                  />
                  <input
                    type="number"
                    min="0"
                    max="60000"
                    step="500"
                    value={typeof config.retryDelayMs === "number" ? config.retryDelayMs : ""}
                    placeholder="2000"
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        retryDelayMs: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <FieldLabelWithHelp
                    label={t("timeout")}
                    help={getI18nOrFallback(
                      t,
                      "advancedHelp.timeout",
                      ADVANCED_FIELD_HELP_FALLBACK.timeout
                    )}
                  />
                  <input
                    type="number"
                    min="1000"
                    max="600000"
                    step="1000"
                    value={typeof config.timeoutMs === "number" ? config.timeoutMs : ""}
                    placeholder="120000"
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        timeoutMs: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabelWithHelp
                    label={t("healthcheck")}
                    help={getI18nOrFallback(
                      t,
                      "advancedHelp.healthcheck",
                      ADVANCED_FIELD_HELP_FALLBACK.healthcheck
                    )}
                  />
                  <input
                    type="checkbox"
                    checked={config.healthCheckEnabled !== false}
                    onChange={(e) => setConfig({ ...config, healthCheckEnabled: e.target.checked })}
                    className="accent-primary"
                  />
                </div>
              </div>
              {strategy === "round-robin" && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <div>
                    <FieldLabelWithHelp
                      label={t("concurrencyPerModel")}
                      help={getI18nOrFallback(
                        t,
                        "advancedHelp.concurrencyPerModel",
                        ADVANCED_FIELD_HELP_FALLBACK.concurrencyPerModel
                      )}
                    />
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={
                        typeof config.concurrencyPerModel === "number"
                          ? config.concurrencyPerModel
                          : ""
                      }
                      placeholder="3"
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          concurrencyPerModel: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <FieldLabelWithHelp
                      label={t("queueTimeout")}
                      help={getI18nOrFallback(
                        t,
                        "advancedHelp.queueTimeout",
                        ADVANCED_FIELD_HELP_FALLBACK.queueTimeout
                      )}
                    />
                    <input
                      type="number"
                      min="1000"
                      max="120000"
                      step="1000"
                      value={typeof config.queueTimeoutMs === "number" ? config.queueTimeoutMs : ""}
                      placeholder="30000"
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          queueTimeoutMs: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}
              <p className="text-[10px] text-text-muted">{t("advancedHint")}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-primary">smart_toy</span>
              <p className="text-xs font-medium">Agent Features</p>
              <span className="text-[10px] text-text-muted">
                — optional, for agent/tool workflows
              </span>
            </div>

            <div>
              <label className="text-[11px] font-medium text-text-muted block mb-0.5">
                System Message Override
              </label>
              <textarea
                rows={2}
                value={agentSystemMessage}
                onChange={(e) => setAgentSystemMessage(e.target.value)}
                placeholder="Override the system prompt for all requests routed through this combo…"
                className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none resize-none"
              />
              <p className="text-[10px] text-text-muted mt-0.5">
                Replaces any system message sent by the client. Leave empty to pass through client
                system messages.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="text-[11px] font-medium text-text-muted block">
                  Require tool-calling models
                </label>
                <p className="text-[10px] text-text-muted">
                  When the request includes tools, skip combo entries that do not support tool
                  calling (priority / weighted / round-robin, etc.).
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireToolCalling}
                onChange={(e) => setRequireToolCalling(e.target.checked)}
                className="accent-primary shrink-0"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-text-muted block mb-0.5">
                Tool Filter Regex
              </label>
              <input
                type="text"
                value={agentToolFilter}
                onChange={(e) => setAgentToolFilter(e.target.value)}
                placeholder="e.g. ^(bash|computer)$"
                className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none font-mono"
              />
              <p className="text-[10px] text-text-muted mt-0.5">
                Only tools whose name matches this regex are forwarded to the provider. Leave empty
                to forward all tools.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="text-[11px] font-medium text-text-muted block">
                  Context Cache Protection
                </label>
                <p className="text-[10px] text-text-muted">
                  Pins the provider/model across turns to preserve cache sessions. Internal tags are
                  stripped before forwarding to the provider.
                </p>
              </div>
              <input
                type="checkbox"
                checked={agentContextCache}
                onChange={(e) => setAgentContextCache(e.target.checked)}
                className="accent-primary shrink-0"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">
              {tc("cancel")}
            </Button>
            <Button
              data-testid="combo-form-submit"
              onClick={handleSave}
              fullWidth
              size="sm"
              disabled={saveBlocked}
            >
              {saving ? t("saving") : isEdit ? tc("save") : t("createCombo")}
            </Button>
          </div>
        </div>
      </Modal>

      <ModelSelectModal
        isOpen={showModelSelect}
        onClose={() => setShowModelSelect(false)}
        onSelect={handleToggleModel}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title={t("addModelToCombo")}
        selectedModel={null}
        addedModelValues={models.map((m) => m.model)}
        multiSelect
        enableModelTest
      />
    </>
  );
}
