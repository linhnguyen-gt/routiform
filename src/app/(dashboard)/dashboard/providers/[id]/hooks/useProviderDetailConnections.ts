import { useCallback, useEffect, useState } from "react";

export interface UseProviderDetailConnectionsParams {
  providerId: string;
  isCompatible: boolean;
}

export interface UseProviderDetailConnectionsReturn {
  connections: unknown[];
  loading: boolean;
  providerNode: unknown;
  setConnections: React.Dispatch<React.SetStateAction<unknown[]>>;
  fetchConnections: () => Promise<void>;
  handleUpdateNode: (formData: Record<string, unknown>) => Promise<void>;
}

export function useProviderDetailConnections({
  providerId,
  isCompatible,
}: UseProviderDetailConnectionsParams): UseProviderDetailConnectionsReturn {
  const [connections, setConnections] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerNode, setProviderNode] = useState<unknown>(null);

  const fetchConnections = useCallback(async () => {
    try {
      const [connectionsRes, nodesRes] = await Promise.all([
        fetch("/api/providers", { cache: "no-store" }),
        fetch("/api/provider-nodes", { cache: "no-store" }),
      ]);
      const connectionsData = await connectionsRes.json();
      const nodesData = await nodesRes.json();
      if (connectionsRes.ok) {
        const filtered = (connectionsData.connections || []).filter(
          (c: Record<string, unknown>) => c.provider === providerId
        );
        setConnections(filtered);
      }
      if (nodesRes.ok) {
        let node =
          (nodesData.nodes || []).find(
            (entry: Record<string, unknown>) => entry.id === providerId
          ) || null;

        // Newly created compatible nodes can be briefly unavailable on one worker.
        // Retry a few times before showing "Provider not found".
        if (!node && isCompatible) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            const retryRes = await fetch("/api/provider-nodes", { cache: "no-store" });
            if (!retryRes.ok) continue;
            const retryData = await retryRes.json();
            node =
              (retryData.nodes || []).find(
                (entry: Record<string, unknown>) => entry.id === providerId
              ) || null;
            if (node) break;
          }
        }

        setProviderNode(node);
      }
    } catch (err) {
      console.log("Error fetching connections:", err);
    } finally {
      setLoading(false);
    }
  }, [providerId, isCompatible]);

  const handleUpdateNode = useCallback(
    async (formData: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/provider-nodes/${providerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (res.ok) {
          setProviderNode(data.node);
          await fetchConnections();
        }
      } catch (err) {
        console.log("Error updating provider node:", err);
      }
    },
    [providerId, fetchConnections]
  );

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  return {
    connections,
    loading,
    providerNode,
    fetchConnections,
    setConnections,
    handleUpdateNode,
  };
}
