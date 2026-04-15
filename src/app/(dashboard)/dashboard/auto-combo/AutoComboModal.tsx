import { useState, useEffect } from "react";
import { Modal, Input, Button } from "@/shared/components";
import { useTranslations } from "next-intl";

export default function AutoComboModal({ isOpen, onClose, onSave, combo, activeProviders = [] }) {
  const tc = useTranslations("common");
  const [formData, setFormData] = useState({
    name: "",
    strategy: "auto",
    candidatePool: [],
    explorationRate: 0.05,
    modePack: "ship-fast",
    budgetCap: "",
  });

  useEffect(() => {
    if (combo) {
      // eslint-disable-next-line
      setFormData({
        name: combo.name || "",
        strategy: combo.strategy || "auto",
        candidatePool: combo.config?.candidatePool || [],
        explorationRate: combo.config?.explorationRate ?? 0.05,
        modePack: combo.config?.modePack || "ship-fast",
        budgetCap: combo.config?.budgetCap || "",
      });
    } else {
      setFormData({
        name: "",
        strategy: "auto",
        candidatePool: [],
        explorationRate: 0.05,
        modePack: "ship-fast",
        budgetCap: "",
      });
    }
  }, [combo, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      strategy: formData.strategy,
      config: {
        candidatePool: formData.candidatePool,
        explorationRate: Number(formData.explorationRate),
        modePack: formData.modePack,
        budgetCap: formData.budgetCap ? Number(formData.budgetCap) : undefined,
      },
    });
  };

  const handleProviderToggle = (providerId) => {
    setFormData((prev) => {
      const pool = prev.candidatePool.includes(providerId)
        ? prev.candidatePool.filter((id) => id !== providerId)
        : [...prev.candidatePool, providerId];
      return { ...prev, candidatePool: pool };
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={combo ? "Edit Auto-Combo" : "Create Auto-Combo"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Combo Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          pattern="^[a-zA-Z0-9_\/\.\-]+$"
          disabled={!!combo} // Cannot change name if editing
        />

        <div>
          <label className="text-sm font-medium mb-1 block">Strategy</label>
          <select
            className="w-full text-sm rounded-lg border border-border bg-surface px-3 py-2 text-text-main focus:border-primary focus:outline-none"
            value={formData.strategy}
            onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
          >
            <option value="auto">Smart Auto-Routing</option>
            <option value="lkgp">Last Known Good Provider (LKGP)</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Candidate Pool</label>
          <p className="text-xs text-text-muted mb-2">
            Select which providers this engine evaluates.
          </p>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-border rounded-lg">
            {activeProviders.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProviderToggle(p.id)}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  formData.candidatePool.includes(p.id)
                    ? "bg-primary border-primary text-white"
                    : "bg-surface border-border text-text-main"
                }`}
              >
                {p.name || p.id}
              </button>
            ))}
            {activeProviders.length === 0 && (
              <span className="text-xs text-text-muted">No active APIs found</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Exploration Rate"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={formData.explorationRate}
            onChange={(e) =>
              setFormData({ ...formData, explorationRate: parseFloat(e.target.value) || 0 })
            }
          />
          <div>
            <label className="text-sm font-medium mb-1 block">Mode Pack</label>
            <select
              className="w-full text-sm rounded-lg border border-border bg-surface px-3 py-2 text-text-main focus:border-primary focus:outline-none"
              value={formData.modePack}
              onChange={(e) => setFormData({ ...formData, modePack: e.target.value })}
            >
              <option value="ship-fast">Ship Fast</option>
              <option value="cost-saver">Cost Saver</option>
              <option value="quality-first">Quality First</option>
              <option value="offline-friendly">Offline Friendly</option>
            </select>
          </div>
        </div>

        <Input
          label="Budget Cap ($ USD / request limit)"
          type="number"
          step="0.0001"
          placeholder="Optional"
          value={formData.budgetCap}
          onChange={(e) => setFormData({ ...formData, budgetCap: e.target.value })}
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit">{tc("save")}</Button>
        </div>
      </form>
    </Modal>
  );
}
