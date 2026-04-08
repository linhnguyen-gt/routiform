"use client";

interface ProviderDetailExtraApiKeysFieldProps {
  extraApiKeys: string[];
  newExtraKey: string;
  setExtraApiKeys: (next: string[]) => void;
  setNewExtraKey: (next: string) => void;
}

export function ProviderDetailExtraApiKeysField({
  extraApiKeys,
  newExtraKey,
  setExtraApiKeys,
  setNewExtraKey,
}: ProviderDetailExtraApiKeysFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-text-main">
        Extra API Keys
        <span className="ml-2 text-[11px] font-normal text-text-muted">
          (round-robin rotation — optional)
        </span>
      </label>
      {extraApiKeys.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {extraApiKeys.map((key, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="flex-1 font-mono text-xs bg-sidebar/50 px-3 py-2 rounded border border-border text-text-muted truncate">
                {`Key #${idx + 2}: ${key.slice(0, 6)}...${key.slice(-4)}`}
              </span>
              <button
                onClick={() => setExtraApiKeys(extraApiKeys.filter((_, i) => i !== idx))}
                className="p-1.5 rounded hover:bg-red-500/10 text-red-400 hover:text-red-500"
                title="Remove this key"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="password"
          value={newExtraKey}
          onChange={(e) => setNewExtraKey(e.target.value)}
          placeholder="Add another API key..."
          className="flex-1 text-sm bg-sidebar/50 border border-border rounded px-3 py-2 text-text-main placeholder:text-text-muted focus:ring-1 focus:ring-primary outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newExtraKey.trim()) {
              setExtraApiKeys([...extraApiKeys, newExtraKey.trim()]);
              setNewExtraKey("");
            }
          }}
        />
        <button
          onClick={() => {
            if (newExtraKey.trim()) {
              setExtraApiKeys([...extraApiKeys, newExtraKey.trim()]);
              setNewExtraKey("");
            }
          }}
          disabled={!newExtraKey.trim()}
          className="px-3 py-2 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 text-sm font-medium"
        >
          Add
        </button>
      </div>
      {extraApiKeys.length > 0 && (
        <p className="text-[11px] text-text-muted">
          {extraApiKeys.length + 1} keys total — rotating round-robin on each request.
        </p>
      )}
    </div>
  );
}
