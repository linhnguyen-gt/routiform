import { useCallback, useEffect, useState } from "react";

export interface UseProviderDetailAliasesReturn {
  modelAliases: Record<string, string>;
  fetchAliases: () => Promise<void>;
  handleSetAlias: (modelId: string, alias: string, providerAliasOverride?: string) => Promise<void>;
  handleDeleteAlias: (alias: string) => Promise<void>;
}

export function useProviderDetailAliases(
  providerAlias: string,
  t: (key: string) => string
): UseProviderDetailAliasesReturn {
  const [modelAliases, setModelAliases] = useState<Record<string, string>>({});

  const fetchAliases = useCallback(async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) {
        setModelAliases(data.aliases || {});
      }
    } catch (error) {
      console.log("Error fetching aliases:", error);
    }
  }, []);

  const handleSetAlias = useCallback(
    async (modelId: string, alias: string, providerAliasOverride = providerAlias) => {
      const fullModel = `${providerAliasOverride}/${modelId}`;
      try {
        const res = await fetch("/api/models/alias", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: fullModel, alias }),
        });
        if (res.ok) {
          await fetchAliases();
        } else {
          const data = await res.json();
          alert(data.error || t("failedSetAlias"));
        }
      } catch (error) {
        console.log("Error setting alias:", error);
      }
    },
    [providerAlias, fetchAliases, t]
  );

  const handleDeleteAlias = useCallback(
    async (alias: string) => {
      try {
        const res = await fetch(`/api/models/alias?alias=${encodeURIComponent(alias)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          await fetchAliases();
        }
      } catch (error) {
        console.log("Error deleting alias:", error);
      }
    },
    [fetchAliases]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAliases();
  }, [fetchAliases]);

  return {
    modelAliases,
    fetchAliases,
    handleSetAlias,
    handleDeleteAlias,
  };
}
