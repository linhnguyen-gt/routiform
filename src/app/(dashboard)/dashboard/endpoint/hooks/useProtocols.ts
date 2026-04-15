import { useState, useEffect, useCallback } from "react";
import { A2AStatus, McpStatus } from "../types";

export function useProtocols() {
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);
  const [a2aStatus, setA2aStatus] = useState<A2AStatus | null>(null);

  const fetchProtocolStatus = useCallback(async () => {
    try {
      const [mcpRes, a2aRes] = await Promise.allSettled([
        fetch("/api/mcp/status"),
        fetch("/api/a2a/status"),
      ]);

      if (mcpRes.status === "fulfilled" && mcpRes.value.ok) {
        setMcpStatus((await mcpRes.value.json()) as McpStatus);
      }
      if (a2aRes.status === "fulfilled" && a2aRes.value.ok) {
        setA2aStatus((await a2aRes.value.json()) as A2AStatus);
      }
    } catch {
      // Ignore status failures; protocols panel has fallback text.
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchProtocolStatus();
    }, 0);
    const interval = setInterval(() => {
      void fetchProtocolStatus();
    }, 30000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [fetchProtocolStatus]);

  return {
    mcpStatus,
    a2aStatus,
    refreshProtocols: fetchProtocolStatus,
  };
}
