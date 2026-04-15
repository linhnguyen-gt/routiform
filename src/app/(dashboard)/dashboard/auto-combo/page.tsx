/**
 * Dashboard Auto-Combo Panel — /dashboard/auto-combo
 *
 * Shows provider scores, scoring factors, exclusions, mode packs, and routing history.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Button } from "@/shared/components";
import AutoComboModal from "./AutoComboModal";
import { useNotificationStore } from "@/store/notificationStore";

interface ModePack {
  id: string;
  label: string;
  icon: string;
}

interface ProviderScore {
  provider: string;
  model: string;
  score: number;
  factors: Record<string, number>;
}

interface ExclusionEntry {
  provider: string;
  excludedAt: string;
  cooldownMs: number;
  reason: string;
}

interface AutoCombo {
  id: string;
  name: string;
  strategy: string;
  config?: {
    candidatePool?: string[];
    modePack?: string;
    explorationRate?: number;
    budgetCap?: string | number;
  };
  weights?: Record<string, unknown>;
}

interface ActiveProvider {
  id?: string;
  name?: string;
  testStatus?: string;
}

interface ComboFormData {
  name: string;
  strategy: string;
  config?: {
    candidatePool?: string[];
    explorationRate?: number;
    modePack?: string;
    budgetCap?: number;
  };
}

type HealthRecord = {
  providerHealth?: Record<string, { state?: string; lastFailure?: string | null }>;
  circuitBreakers?: Array<{
    provider?: string;
    name?: string;
    state?: string;
    lastFailure?: string | null;
  }>;
};

export default function AutoComboDashboard() {
  const [scores, setScores] = useState<ProviderScore[]>([]);
  const [exclusions, setExclusions] = useState<ExclusionEntry[]>([]);
  const [incidentMode, setIncidentMode] = useState(false);
  const [modePack, setModePack] = useState("ship-fast");

  const notify = useNotificationStore();
  const [combos, setCombos] = useState<AutoCombo[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<AutoCombo | null>(null);
  const [activeProviders, setActiveProviders] = useState<ActiveProvider[]>([]);

  const fetchCombos = useCallback(async () => {
    try {
      const res = await fetch("/api/combos");
      if (res.ok) {
        const payload = await res.json();
        const allCombos = Array.isArray(payload?.combos) ? payload.combos : [];
        const auto = (allCombos as AutoCombo[]).filter(
          (c) => c.strategy === "auto" || c.strategy === "lkgp"
        );
        setCombos(auto);

        // Refresh scores based on first auto combo found
        const firstCombo = auto[0] || null;
        const candidatePool = Array.isArray(firstCombo?.config?.candidatePool)
          ? firstCombo.config.candidatePool
          : [];
        const rawWeights =
          firstCombo?.weights &&
          typeof firstCombo.weights === "object" &&
          !Array.isArray(firstCombo.weights)
            ? (firstCombo.weights as Record<string, unknown>)
            : {};
        const factors = Object.fromEntries(
          Object.entries(rawWeights).map(([k, v]) => [k, typeof v === "number" ? v : 0])
        );
        const baseScore = candidatePool.length > 0 ? 1 / candidatePool.length : 0;
        setScores(
          candidatePool.map((provider) => ({
            provider,
            model: "auto",
            score: baseScore,
            factors,
          }))
        );
      } else {
        setScores([]);
      }
    } catch {
      setScores([]);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const healthRes = await fetch("/api/monitoring/health");
      if (healthRes.ok) {
        const health = (await healthRes.json()) as HealthRecord;
        const providerHealth =
          health?.providerHealth && typeof health.providerHealth === "object"
            ? health.providerHealth
            : {};
        const breakersFromProviderHealth = Object.entries(providerHealth).map(
          ([provider, status]) => ({
            provider,
            state: status?.state || "CLOSED",
            lastFailure: status?.lastFailure || null,
          })
        );
        const breakersFromArray = Array.isArray(health?.circuitBreakers)
          ? health.circuitBreakers
          : [];
        const breakers =
          breakersFromArray.length > 0
            ? breakersFromArray.map((breaker) => ({
                provider: breaker.provider || breaker.name || "unknown",
                state: breaker.state || "CLOSED",
                lastFailure: breaker.lastFailure || null,
              }))
            : breakersFromProviderHealth;

        const openBreakers = breakers.filter((breaker) => breaker.state === "OPEN");
        setIncidentMode(openBreakers.length / Math.max(breakers.length, 1) > 0.5);
        setExclusions(
          openBreakers.map((breaker) => ({
            provider: breaker.provider,
            excludedAt: breaker.lastFailure || new Date().toISOString(),
            cooldownMs: 5 * 60 * 1000,
            reason: "Circuit breaker OPEN",
          }))
        );
      } else {
        setIncidentMode(false);
        setExclusions([]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchCombos(), fetchHealth()]);

    // Fetch active providers for the Modal
    try {
      const pRes = await fetch("/api/providers");
      if (pRes.ok) {
        const pData = await pRes.json();
        setActiveProviders(
          (pData.connections as ActiveProvider[]).filter(
            (c) => c.testStatus === "active" || c.testStatus === "success"
          )
        );
      }
    } catch {}
  }, [fetchCombos, fetchHealth]);

  useEffect(() => {
    const id = setTimeout(fetchData, 0);
    const interval = setInterval(fetchData, 30_000);
    return () => {
      clearTimeout(id);
      clearInterval(interval);
    };
  }, [fetchData]);

  const handleCreate = async (data: ComboFormData) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchCombos();
        setShowCreateModal(false);
        notify.success("Auto-Combo created successfully");
      } else {
        const err = await res.json();
        notify.error(err.error?.message || err.error || "Failed to create combo");
      }
    } catch {
      notify.error("Error creating combo");
    }
  };

  const handleUpdate = async (id: string, data: ComboFormData) => {
    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchCombos();
        setEditingCombo(null);
        notify.success("Auto-Combo updated");
      } else {
        const err = await res.json();
        notify.error("Failed to update: " + (err.error?.message || err.error));
      }
    } catch {
      notify.error("Error updating combo");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this auto-combo?")) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCombos(combos.filter((c) => c.id !== id));
        notify.success("Auto-combo deleted");
      }
    } catch {
      notify.error("Error deleting combo");
    }
  };

  const FACTOR_LABELS: Record<string, string> = {
    quota: "Quota",
    health: "Health",
    costInv: "Cost",
    latencyInv: "Latency",
    taskFit: "Task Fit",
    stability: "Stability",
    tierPriority: "Tier",
  };

  const MODE_PACKS: ModePack[] = [
    { id: "ship-fast", label: "Ship Fast", icon: "rocket_launch" },
    { id: "cost-saver", label: "Cost Saver", icon: "savings" },
    { id: "quality-first", label: "Quality First", icon: "workspace_premium" },
    { id: "offline-friendly", label: "Offline Friendly", icon: "network_check" },
  ];

  const selectedModePack = MODE_PACKS.find((m) => m.id === modePack);
  const statusTone = incidentMode
    ? {
        wrapper: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        icon: "warning",
        title: "Incident Mode",
        description: "High circuit breaker trip rate detected",
      }
    : {
        wrapper: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        icon: "check_circle",
        title: "Normal Operation",
        description: "All providers reporting healthy metrics",
      };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              auto_awesome
            </span>
            Auto-Combo Engine
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Smart routing automatically adapting to latency, health, and throughput
          </p>
        </div>
        {combos.length > 0 && (
          <Button
            icon="add"
            onClick={() => setShowCreateModal(true)}
            aria-label="Create auto combo"
            className="flex-shrink-0"
          >
            Create Auto-Combo
          </Button>
        )}
      </header>

      {/* ──── CRUD Auto Combos List ──── */}
      {combos.length > 0 ? (
        <Card className="border border-border-subtle bg-surface/70" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <span
              className="material-symbols-outlined text-[18px] text-blue-500"
              aria-hidden="true"
            >
              deployed_code
            </span>
            <h2 className="text-lg font-semibold">Configured Auto-Combos</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {combos.map((combo) => (
              <div
                key={combo.id}
                className="p-4 border border-border-subtle rounded-xl bg-bg-secondary/40 flex justify-between items-center gap-3"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-text-main flex items-center gap-2">
                    <span className="truncate">{combo.name}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 flex-shrink-0">
                      {combo.strategy}
                    </span>
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    Pool: {combo.config?.candidatePool?.length || "All"} APIs | Pack:{" "}
                    {combo.config?.modePack || "fast"}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => setEditingCombo(combo)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(combo.id)}
                    aria-label={`Delete ${combo.name}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="border border-dashed border-border-subtle bg-surface/60" padding="lg">
          <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-2">
            <span
              className="material-symbols-outlined text-[32px] text-text-muted"
              aria-hidden="true"
            >
              account_tree
            </span>
            <p className="font-medium text-text-main">No auto-combo configured yet</p>
            <p className="text-sm text-text-muted max-w-md">
              Create one to automatically route traffic based on provider health, latency, and cost.
            </p>
            <Button
              size="sm"
              icon="add"
              onClick={() => setShowCreateModal(true)}
              aria-label="Create auto combo"
            >
              Create Auto-Combo
            </Button>
          </div>
        </Card>
      )}

      {/* Forms */}
      {showCreateModal && (
        <AutoComboModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
          activeProviders={activeProviders}
          combo={null}
        />
      )}
      {editingCombo && (
        <AutoComboModal
          isOpen={!!editingCombo}
          onClose={() => setEditingCombo(null)}
          onSave={(data: ComboFormData) => handleUpdate(editingCombo.id, data)}
          activeProviders={activeProviders}
          combo={editingCombo}
        />
      )}

      <Card className="border border-border-subtle bg-surface/70" padding="lg">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-4">Status Overview</h2>
            <div className="flex flex-col gap-3">
              <div
                role="status"
                aria-live="polite"
                className={`p-4 rounded-xl border flex items-center justify-between ${statusTone.wrapper}`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px]">{statusTone.icon}</span>
                  <div>
                    <h3 className="font-semibold">{statusTone.title}</h3>
                    <p className="text-sm opacity-80">{statusTone.description}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border-subtle bg-bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px] text-blue-500">tune</span>
                  <div>
                    <h3 className="font-semibold">Active Mode Pack</h3>
                    <p className="text-sm text-text-muted">{selectedModePack?.label || modePack}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-4">Mode Pack</h2>
            <div className="grid grid-cols-2 gap-2">
              {MODE_PACKS.map((mp) => (
                <button
                  key={mp.id}
                  onClick={() => setModePack(mp.id)}
                  aria-pressed={modePack === mp.id}
                  aria-label={`Set ${mp.label} mode pack`}
                  className={`flex flex-col items-start p-3 rounded-lg border transition-all ${
                    modePack === mp.id
                      ? "border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20"
                      : "border-border/50 hover:border-border hover:bg-surface/30"
                  }`}
                >
                  <span className="material-symbols-outlined text-base mb-1" aria-hidden="true">
                    {mp.icon}
                  </span>
                  <span className={`font-medium ${modePack === mp.id ? "text-blue-500" : ""}`}>
                    {mp.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border-subtle bg-surface/70" padding="lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                leaderboard
              </span>
            </div>
            <h3 className="text-lg font-semibold">Provider Scores</h3>
          </div>

          {scores.length === 0 ? (
            <p className="text-sm text-text-muted py-4">
              No auto-combo configured... Create one to see live provider scores.
            </p>
          ) : (
            <div className="space-y-3">
              {scores.map((s) => (
                <div
                  key={s.provider}
                  className="p-3 bg-bg-secondary/40 rounded-xl border border-border-subtle"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">
                      {s.provider} / {s.model}
                    </span>
                    <span className="font-bold text-lg text-blue-500">
                      {(s.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {/* Score Bar */}
                  <div className="h-1.5 bg-border/50 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000 motion-reduce:transition-none"
                      style={{ width: `${s.score * 100}%` }}
                      role="progressbar"
                      aria-label={`${s.provider} score`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(s.score * 100)}
                    />
                  </div>
                  {/* Factor Breakdown */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-text-muted">
                    {Object.entries(s.factors || {}).map(([key, val]) => (
                      <div
                        key={key}
                        className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-border-subtle"
                      >
                        {FACTOR_LABELS[key] || key}:{" "}
                        <span className="font-medium text-text-main">
                          {((val as number) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="border border-border-subtle bg-surface/70" padding="lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                block
              </span>
            </div>
            <h3 className="text-lg font-semibold">Excluded Providers</h3>
          </div>

          {exclusions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-muted">
              <span className="material-symbols-outlined text-[32px] mb-2 text-border">
                verified
              </span>
              <p className="text-sm">No providers currently excluded.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exclusions.map((e) => (
                <div
                  key={e.provider}
                  className="p-3 bg-red-500/5 rounded-xl border border-red-500/20"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {e.provider}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
                      Cooldown: {Math.round(e.cooldownMs / 60000)}m
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">info</span>
                    {e.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
