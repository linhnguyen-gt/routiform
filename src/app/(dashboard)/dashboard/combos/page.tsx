"use client";

import {
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  Modal,
  ProxyConfigModal,
} from "@/shared/components";
import ModelRoutingSection from "@/shared/components/ModelRoutingSection";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useNotificationStore } from "@/store/notificationStore";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ComboCard } from "./components/ComboCard";
import { ComboFormModal } from "./components/ComboFormModal";
import { ComboUsageGuide } from "./components/ComboUsageGuide";
import { TestResultsView } from "./components/TestResultsView";
import { COMBO_USAGE_GUIDE_STORAGE_KEY } from "./components/combo-constants";
import { getI18nOrFallback } from "./components/combo-utils";

export default function CombosPage() {
  const t = useTranslations("combos");
  const tc = useTranslations("common");
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<any>(null);
  const [activeProviders, setActiveProviders] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [testResults, setTestResults] = useState<any>(null);
  const [testingCombo, setTestingCombo] = useState<string | null>(null);
  const [testComboName, setTestComboName] = useState("");
  const { copied, copy } = useCopyToClipboard();
  const notify = useNotificationStore();
  const [proxyTargetCombo, setProxyTargetCombo] = useState<any>(null);
  const [proxyConfig, setProxyConfig] = useState<any>(null);
  const [providerNodes, setProviderNodes] = useState<any[]>([]);
  const [showUsageGuide, setShowUsageGuide] = useState(true);
  const [recentlyCreatedCombo, setRecentlyCreatedCombo] = useState("");
  const [liveRegionText, setLiveRegionText] = useState("");
  const [comboDragIndex, setComboDragIndex] = useState<number | null>(null);
  const [comboDragOverIndex, setComboDragOverIndex] = useState<number | null>(null);
  const combosRef = useRef(combos);
  combosRef.current = combos;

  useEffect(() => {
    fetchData();
    fetch("/api/settings/proxy")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setProxyConfig(c))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (globalThis.localStorage?.getItem(COMBO_USAGE_GUIDE_STORAGE_KEY) === "1") {
        setShowUsageGuide(false);
      }
    } catch {
      // Ignore storage access errors (privacy mode / restricted environments)
    }
  }, []);

  const fetchData = async () => {
    try {
      const [combosRes, providersRes, metricsRes, nodesRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/providers"),
        fetch("/api/combos/metrics"),
        fetch("/api/provider-nodes"),
      ]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();
      const metricsData = await metricsRes.json();
      const nodesData = nodesRes.ok ? await nodesRes.json() : { nodes: [] };

      if (combosRes.ok) setCombos(combosData.combos || []);
      if (providersRes.ok) {
        // Match 9router: show all connections in Add Model — new keys are often testStatus "unknown"
        // until the user runs Test; filtering to active/success hid OpenRouter and other API-key providers.
        setActiveProviders(providersData.connections || []);
      }
      if (metricsRes.ok) setMetrics(metricsData.metrics || {});
      setProviderNodes(nodesData.nodes || []);
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        // Close modal and surface quick-test CTA immediately — do not block on fetchData().
        // Otherwise a slow or stuck refresh keeps the dialog open and breaks E2E/UX.
        setShowCreateModal(false);
        setRecentlyCreatedCombo(data.name?.trim() || "");
        notify.success(t("comboCreated"));
        await fetchData();
      } else {
        const err = await res.json();
        notify.error(err.error?.message || err.error || t("failedCreate"));
      }
    } catch (_error) {
      notify.error(t("errorCreating"));
    }
  };

  const handleUpdate = async (id: string, data: any) => {
    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setEditingCombo(null);
        notify.success(t("comboUpdated"));
      } else {
        const err = await res.json();
        notify.error(err.error?.message || err.error || t("failedUpdate"));
      }
    } catch (_error) {
      notify.error(t("errorUpdating"));
    }
  };

  const handleComboDragStart = (e: React.DragEvent, index: number) => {
    setComboDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    const el = e.currentTarget as HTMLElement | null;
    if (el)
      setTimeout(() => {
        if (el.isConnected) el.style.opacity = "0.5";
      }, 0);
  };

  const handleComboDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement | null;
    if (el) el.style.opacity = "1";
    setComboDragIndex(null);
    setComboDragOverIndex(null);
  };

  const handleComboDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setComboDragOverIndex(index);
  };

  const moveCombo = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const currentCombos = combosRef.current;
      if (
        fromIndex < 0 ||
        fromIndex >= currentCombos.length ||
        toIndex < 0 ||
        toIndex >= currentCombos.length ||
        fromIndex === toIndex
      ) {
        return;
      }

      const originalCombos = [...currentCombos];

      const reordered = [...currentCombos];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      setCombos(reordered);
      setComboDragIndex(null);
      setComboDragOverIndex(null);

      const comboName = originalCombos[fromIndex].name;
      setLiveRegionText(
        t("comboMoved", {
          name: comboName,
          from: fromIndex + 1,
          to: toIndex + 1,
          defaultValue: `${comboName} moved from position ${fromIndex + 1} to position ${toIndex + 1}`,
        })
      );

      try {
        const res = await fetch("/api/combos/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: reordered.map((c) => c.id) }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.updated === 0) throw new Error("No combos updated");
      } catch {
        setCombos(originalCombos);
        notify.error(t("errorUpdating"));
      }
    },
    [notify, t]
  );

  const handleComboDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = comboDragIndex;
    if (fromIndex === null || fromIndex === dropIndex) {
      setComboDragIndex(null);
      setComboDragOverIndex(null);
      return;
    }

    await moveCombo(fromIndex, dropIndex);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCombos(combos.filter((c) => c.id !== id));
        notify.success(t("comboDeleted"));
      }
    } catch (_error) {
      notify.error(t("errorDeleting"));
    }
  };

  const handleDuplicate = async (combo: any) => {
    const baseName = combo.name.replace(/-copy(-\d+)?$/, "");
    const existingNames = combos.map((c) => c.name);
    let newName = `${baseName}-copy`;
    let counter = 1;
    while (existingNames.includes(newName)) {
      counter++;
      newName = `${baseName}-copy-${counter}`;
    }

    const data = {
      name: newName,
      models: combo.models,
      strategy: combo.strategy || "priority",
      config: combo.config || {},
    };

    await handleCreate(data);
  };

  const handleTestCombo = async (combo: { name: string }) => {
    setTestingCombo(combo.name);
    setTestComboName(combo.name);
    setTestResults(null);
    try {
      const res = await fetch("/api/combos/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboName: combo.name }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await res.json().catch(() => ({ error: t("testFailed") }));
      if (!res.ok) {
        setTestResults({ error: data?.error || t("testFailed") });
        notify.error(t("testFailed"));
        return;
      }
      setTestResults(data || { error: t("testFailed") });
    } catch (_error) {
      setTestResults({ error: t("testFailed") });
      notify.error(t("testFailed"));
    } finally {
      setTestingCombo(null);
    }
  };

  const handleToggleCombo = async (combo: any) => {
    const newActive = combo.isActive === false ? true : false;
    setCombos((prev) => prev.map((c) => (c.id === combo.id ? { ...c, isActive: newActive } : c)));
    try {
      await fetch(`/api/combos/${combo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
    } catch (_error) {
      setCombos((prev) =>
        prev.map((c) => (c.id === combo.id ? { ...c, isActive: !newActive } : c))
      );
      notify.error(t("failedToggle"));
    }
  };

  const handleHideUsageGuideForever = () => {
    setShowUsageGuide(false);
    try {
      globalThis.localStorage?.setItem(COMBO_USAGE_GUIDE_STORAGE_KEY, "1");
    } catch {}
  };

  const handleShowUsageGuide = () => {
    setShowUsageGuide(true);
    try {
      globalThis.localStorage?.removeItem(COMBO_USAGE_GUIDE_STORAGE_KEY);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-text-muted mt-1">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          {!showUsageGuide && (
            <Button size="sm" variant="ghost" onClick={handleShowUsageGuide}>
              {getI18nOrFallback(t, "usageGuideShow", "Show guide")}
            </Button>
          )}
          <Button
            data-testid="combos-header-create"
            icon="add"
            onClick={() => setShowCreateModal(true)}
          >
            {t("createCombo")}
          </Button>
        </div>
      </div>

      {showUsageGuide && (
        <ComboUsageGuide
          onHide={() => setShowUsageGuide(false)}
          onHideForever={handleHideUsageGuideForever}
        />
      )}

      {recentlyCreatedCombo && (
        <Card
          padding="sm"
          className="border border-emerald-500/20 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {getI18nOrFallback(
                  t,
                  "quickTestTitle",
                  `Combo "${recentlyCreatedCombo}" ready to validate`
                )}
              </p>
              <code className="inline-block text-[11px] mt-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                {recentlyCreatedCombo}
              </code>
              <p className="text-xs text-text-muted mt-0.5">
                {getI18nOrFallback(
                  t,
                  "quickTestDescription",
                  "Run a test now to confirm fallback and latency behavior."
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon="play_arrow"
                onClick={() => {
                  handleTestCombo({ name: recentlyCreatedCombo });
                  setRecentlyCreatedCombo("");
                }}
              >
                {getI18nOrFallback(t, "testNow", "Test now")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRecentlyCreatedCombo("")}>
                {tc("close")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveRegionText}
      </div>

      <ModelRoutingSection combos={combos} />

      {combos.length === 0 ? (
        <EmptyState
          icon="🧩"
          title={t("noCombosYet")}
          description={t("description")}
          actionLabel={t("createCombo")}
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div
          role="list"
          aria-label={t("comboList", { defaultValue: "Combos" })}
          className="flex flex-col gap-4"
        >
          {combos.map((combo, index) => (
            <div
              key={combo.id}
              draggable
              tabIndex={0}
              role="listitem"
              aria-roledescription="draggable combo"
              aria-grabbed={comboDragIndex === index}
              onDragStart={(e) => handleComboDragStart(e, index)}
              onDragEnd={handleComboDragEnd}
              onDragOver={(e) => handleComboDragOver(e, index)}
              onDrop={(e) => handleComboDrop(e, index)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" && index > 0) {
                  e.preventDefault();
                  moveCombo(index, index - 1);
                } else if (e.key === "ArrowDown" && index < combos.length - 1) {
                  e.preventDefault();
                  moveCombo(index, index + 1);
                } else if (e.key === "Home") {
                  e.preventDefault();
                  if (index > 0) moveCombo(index, 0);
                } else if (e.key === "End") {
                  e.preventDefault();
                  if (index < combos.length - 1) moveCombo(index, combos.length - 1);
                }
              }}
              className={`transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                comboDragOverIndex === index && comboDragIndex !== index
                  ? "ring-2 ring-primary/40 rounded-xl"
                  : ""
              } ${comboDragIndex === index ? "opacity-50" : ""}`}
            >
              <ComboCard
                combo={combo}
                metrics={metrics[combo.name]}
                providerNodes={providerNodes}
                copied={copied}
                onCopy={copy}
                onEdit={() => setEditingCombo(combo)}
                onDelete={() => handleDelete(combo.id)}
                onDuplicate={() => handleDuplicate(combo)}
                onTest={() => handleTestCombo(combo)}
                testing={testingCombo === combo.name}
                onProxy={() => setProxyTargetCombo(combo)}
                hasProxy={!!proxyConfig?.combos?.[combo.id]}
                onToggle={() => handleToggleCombo(combo)}
                onMoveUp={() => moveCombo(index, index - 1)}
                onMoveDown={() => moveCombo(index, index + 1)}
                canMoveUp={index > 0}
                canMoveDown={index < combos.length - 1}
              />
            </div>
          ))}
        </div>
      )}

      {testResults && (
        <Modal
          isOpen={!!testResults}
          onClose={() => {
            setTestResults(null);
            setTestingCombo(null);
            setTestComboName("");
          }}
          title={t("testResults", { name: testComboName || testingCombo || "" })}
        >
          <TestResultsView results={testResults} />
        </Modal>
      )}

      <ComboFormModal
        key="create"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        activeProviders={activeProviders}
        combo={null}
      />

      <ComboFormModal
        key={editingCombo?.id || "new"}
        isOpen={!!editingCombo}
        combo={editingCombo}
        onClose={() => setEditingCombo(null)}
        onSave={(data) => handleUpdate(editingCombo.id, data)}
        activeProviders={activeProviders}
      />

      {proxyTargetCombo && (
        <ProxyConfigModal
          isOpen={!!proxyTargetCombo}
          onClose={() => setProxyTargetCombo(null)}
          level="combo"
          levelId={proxyTargetCombo.id}
          levelLabel={proxyTargetCombo.name}
        />
      )}
    </div>
  );
}
