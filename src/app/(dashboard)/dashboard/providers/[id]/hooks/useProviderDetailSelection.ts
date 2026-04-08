import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

type ConnectionIdRow = { id?: string };

type UseProviderDetailSelectionParams = {
  connections: ConnectionIdRow[];
  sortedConnectionIds: string[];
  selectAllRef: RefObject<HTMLInputElement | null>;
};

type UseProviderDetailSelectionResult = {
  selectedConnectionIds: string[];
  setSelectedConnectionIds: Dispatch<SetStateAction<string[]>>;
  toggleConnectionBulkSelect: (id: string) => void;
  toggleSelectAllConnections: () => void;
};

export function useProviderDetailSelection({
  connections,
  sortedConnectionIds,
  selectAllRef,
}: UseProviderDetailSelectionParams): UseProviderDetailSelectionResult {
  const [rawSelectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);

  const toggleConnectionBulkSelect = useCallback((id: string) => {
    setSelectedConnectionIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAllConnections = useCallback(() => {
    setSelectedConnectionIds((prev) => {
      if (sortedConnectionIds.length === 0) return [];
      const allSelected = sortedConnectionIds.every((id) => prev.includes(id));
      if (allSelected) return [];
      return [...sortedConnectionIds];
    });
  }, [sortedConnectionIds]);

  const selectedConnectionIds = useMemo(() => {
    const validIds = new Set(
      connections
        .map((connection) => connection.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    );
    return rawSelectedConnectionIds.filter((id) => validIds.has(id));
  }, [connections, rawSelectedConnectionIds]);

  useEffect(() => {
    const selectAllElement = selectAllRef.current;
    if (!selectAllElement) return;

    const someSelected = selectedConnectionIds.some((id) => sortedConnectionIds.includes(id));
    const allSelected =
      sortedConnectionIds.length > 0 &&
      sortedConnectionIds.every((id) => selectedConnectionIds.includes(id));

    selectAllElement.indeterminate = someSelected && !allSelected;
  }, [selectedConnectionIds, selectAllRef, sortedConnectionIds]);

  return {
    selectedConnectionIds,
    setSelectedConnectionIds,
    toggleConnectionBulkSelect,
    toggleSelectAllConnections,
  };
}
