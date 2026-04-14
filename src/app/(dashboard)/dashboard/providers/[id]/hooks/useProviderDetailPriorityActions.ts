import { useCallback } from "react";
import type { ProviderDetailActionProps } from "../types/actions";

export function useProviderDetailPriorityActions({
  connections,
  fetchConnections,
}: Pick<ProviderDetailActionProps, "connections" | "fetchConnections">) {
  const handleSwapPriority = useCallback(
    async (conn1: any, conn2: any) => {
      if (!conn1 || !conn2) return;
      try {
        let p1 = conn2.priority;
        let p2 = conn1.priority;

        if (p1 === p2) {
          const isConn1MovingUp = connections.indexOf(conn1) > connections.indexOf(conn2);
          if (isConn1MovingUp) {
            p1 = conn2.priority - 0.5;
          } else {
            p1 = conn2.priority + 0.5;
          }
        }

        await Promise.all([
          fetch(`/api/providers/${conn1.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: p1 }),
          }),
          fetch(`/api/providers/${conn2.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: p2 }),
          }),
        ]);
        await fetchConnections();
      } catch (error) {
        console.log("Error swapping priority:", error);
      }
    },
    [connections, fetchConnections]
  );

  return { handleSwapPriority };
}
