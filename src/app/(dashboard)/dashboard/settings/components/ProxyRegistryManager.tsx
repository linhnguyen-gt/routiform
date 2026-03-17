"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Modal } from "@/shared/components";

type ProxyItem = {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  region?: string | null;
  notes?: string | null;
  status?: string;
};

type UsageInfo = {
  count: number;
  assignments: Array<{ scope: string; scopeId: string | null }>;
};

type HealthInfo = {
  proxyId: string;
  totalRequests: number;
  successRate: number | null;
  avgLatencyMs: number | null;
  lastSeenAt: string | null;
};

const EMPTY_FORM = {
  id: "",
  name: "",
  type: "http",
  host: "",
  port: "8080",
  username: "",
  password: "",
  region: "",
  notes: "",
  status: "active",
};

export default function ProxyRegistryManager() {
  const [items, setItems] = useState<ProxyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [usageById, setUsageById] = useState<Record<string, UsageInfo>>({});
  const [healthById, setHealthById] = useState<Record<string, HealthInfo>>({});
  const [migrating, setMigrating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkScope, setBulkScope] = useState("provider");
  const [bulkScopeIds, setBulkScopeIds] = useState("");
  const [bulkProxyId, setBulkProxyId] = useState("");

  const editingId = useMemo(() => form.id || "", [form.id]);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/proxies/health?hours=24");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const entries = Array.isArray(data?.items) ? data.items : [];
      const mapped = Object.fromEntries(
        entries.map((entry: HealthInfo) => [entry.proxyId, entry])
      ) as Record<string, HealthInfo>;
      setHealthById(mapped);
    } catch {
      // ignore health loading errors in UI
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/proxies");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "Failed to load proxy registry");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      void loadHealth();
    } catch (e: any) {
      setError(e?.message || "Failed to load proxy registry");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [loadHealth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (items.length > 0 && !bulkProxyId) {
      setBulkProxyId(items[0].id);
    }
  }, [items, bulkProxyId]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item: ProxyItem) => {
    setForm({
      id: item.id,
      name: item.name || "",
      type: item.type || "http",
      host: item.host || "",
      port: String(item.port || 8080),
      username: "",
      password: "",
      region: item.region || "",
      notes: item.notes || "",
      status: item.status || "active",
    });
    setModalOpen(true);
  };

  const loadUsage = async (proxyId: string) => {
    try {
      const res = await fetch(
        `/api/settings/proxies?id=${encodeURIComponent(proxyId)}&whereUsed=1`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setUsageById((prev) => ({
        ...prev,
        [proxyId]: {
          count: Number(data?.count || 0),
          assignments: Array.isArray(data?.assignments) ? data.assignments : [],
        },
      }));
    } catch {
      // ignore usage loading errors in UI
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.host.trim()) {
      setError("Name and host are required");
      return;
    }

    setSaving(true);
    setError(null);

    const normalizedUsername = form.username.trim();
    const normalizedPassword = form.password.trim();

    const payload: Record<string, unknown> = {
      ...(editingId ? { id: editingId } : {}),
      name: form.name.trim(),
      type: form.type,
      host: form.host.trim(),
      port: Number(form.port || 8080),
      region: form.region.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
    };
    if (!editingId || normalizedUsername.length > 0) {
      payload.username = normalizedUsername;
    }
    if (!editingId || normalizedPassword.length > 0) {
      payload.password = normalizedPassword;
    }

    try {
      const res = await fetch("/api/settings/proxies", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "Failed to save proxy");
        return;
      }

      setModalOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save proxy");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/proxies?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await load();
        return;
      }

      const payload = await res.json().catch(() => ({}));
      const inUse = res.status === 409;
      if (inUse) {
        const ok = window.confirm(
          "This proxy is still assigned. Force delete and remove all assignments?"
        );
        if (!ok) return;

        const forceRes = await fetch(`/api/settings/proxies?id=${encodeURIComponent(id)}&force=1`, {
          method: "DELETE",
        });

        if (!forceRes.ok) {
          const forcePayload = await forceRes.json().catch(() => ({}));
          setError(forcePayload?.error?.message || "Failed to force delete proxy");
          return;
        }

        await load();
        return;
      }

      setError(payload?.error?.message || "Failed to delete proxy");
    } catch (e: any) {
      setError(e?.message || "Failed to delete proxy");
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/proxies/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "Failed to migrate legacy proxy config");
        return;
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to migrate legacy proxy config");
    } finally {
      setMigrating(false);
    }
  };

  const handleBulkAssign = async () => {
    setBulkSaving(true);
    setError(null);
    try {
      const scopeIds =
        bulkScope === "global"
          ? []
          : bulkScopeIds
              .split(/[\n,]/g)
              .map((part) => part.trim())
              .filter(Boolean);

      const res = await fetch("/api/settings/proxies/bulk-assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: bulkScope,
          scopeIds,
          proxyId: bulkProxyId || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error?.message || "Failed to run bulk assignment");
        return;
      }

      setBulkOpen(false);
      setBulkScopeIds("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to run bulk assignment");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold">Proxy Registry</h3>
            <p className="text-sm text-text-muted">Store reusable proxies and track assignments.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon="upgrade"
              onClick={handleMigrate}
              loading={migrating}
              data-testid="proxy-registry-import-legacy"
            >
              Import Legacy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="account_tree"
              onClick={() => setBulkOpen(true)}
              data-testid="proxy-registry-open-bulk"
            >
              Bulk Assign
            </Button>
            <Button
              size="sm"
              icon="add"
              onClick={openCreate}
              data-testid="proxy-registry-open-create"
            >
              Add Proxy
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-text-muted">Loading proxies...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-text-muted">No saved proxies yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Endpoint</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Health (24h)</th>
                  <th className="py-2 pr-3">Usage</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const usage = usageById[item.id];
                  const health = healthById[item.id];
                  return (
                    <tr key={item.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-text-main">{item.name}</div>
                        {item.region && (
                          <div className="text-xs text-text-muted">{item.region}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-text-muted">
                        {item.type}://{item.host}:{item.port}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-xs px-2 py-1 rounded border border-border bg-bg-subtle">
                          {item.status || "active"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-text-muted">
                        {health ? (
                          <div className="flex flex-col gap-0.5">
                            <span>{health.successRate ?? 0}% success</span>
                            <span>{health.avgLatencyMs ?? "-"} ms avg</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-text-muted">
                        {usage ? `${usage.count} assignment(s)` : "-"}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="visibility"
                            onClick={() => void loadUsage(item.id)}
                          >
                            Usage
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="edit"
                            onClick={() => openEdit(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="delete"
                            onClick={() => void handleDelete(item.id)}
                            className="!text-red-400"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        title={editingId ? "Edit Proxy" : "Create Proxy"}
        maxWidth="lg"
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Name</label>
              <input
                data-testid="proxy-registry-name-input"
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Type</label>
              <select
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Host</label>
              <input
                data-testid="proxy-registry-host-input"
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={form.host}
                onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Port</label>
              <input
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={form.port}
                onChange={(e) => setForm((prev) => ({ ...prev, port: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Username</label>
              <input
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={form.username}
                placeholder={editingId ? "Leave blank to keep current username" : ""}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={form.password}
                placeholder={editingId ? "Leave blank to keep current password" : ""}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Region</label>
              <input
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={form.region}
                onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Status</label>
              <select
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Notes</label>
            <textarea
              className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" icon="save" onClick={handleSave} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={bulkOpen}
        onClose={() => {
          if (!bulkSaving) setBulkOpen(false);
        }}
        title="Bulk Proxy Assignment"
        maxWidth="lg"
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Scope</label>
              <select
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={bulkScope}
                onChange={(e) => setBulkScope(e.target.value)}
              >
                <option value="global">global</option>
                <option value="provider">provider</option>
                <option value="account">account</option>
                <option value="combo">combo</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Proxy</label>
              <select
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                value={bulkProxyId}
                onChange={(e) => setBulkProxyId(e.target.value)}
              >
                <option value="">(clear assignment)</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.type}://{item.host}:{item.port})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {bulkScope !== "global" && (
            <div>
              <label className="text-xs text-text-muted mb-1 block">
                Scope IDs (comma or newline)
              </label>
              <textarea
                data-testid="proxy-registry-bulk-scopeids-input"
                className="w-full px-3 py-2 rounded bg-bg-subtle border border-border"
                rows={5}
                value={bulkScopeIds}
                onChange={(e) => setBulkScopeIds(e.target.value)}
                placeholder="provider-openai,provider-anthropic"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              icon="done_all"
              onClick={handleBulkAssign}
              loading={bulkSaving}
              data-testid="proxy-registry-bulk-apply"
            >
              Apply
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
