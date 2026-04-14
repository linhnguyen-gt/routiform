import type { CompatModelMap, CompatModelRow } from "../types";

export interface ProviderDetailActionProps {
  // Core identifiers
  providerId: string;
  providerAlias: string;
  providerDisplayAlias: string;
  providerStorageAlias: string;

  // State & Data
  connections: Array<Record<string, unknown>>;
  modelMeta: {
    customModels: CompatModelRow[];
    modelCompatOverrides: Array<CompatModelRow & { id: string }>;
  };
  customMap: CompatModelMap;
  overrideMap: CompatModelMap;

  // Actions
  fetchConnections: () => Promise<void>;
  fetchProviderModelMeta: () => Promise<void>;
  fetchAliases: () => Promise<void>;
  handleUpdateNode: (formData: Record<string, unknown>) => Promise<void>;
  setConnections: React.Dispatch<React.SetStateAction<Array<Record<string, unknown>>>>;
  setSelectedConnectionIds: (fn: (prev: string[]) => string[]) => void;
  setOpencodeLiveCatalog: React.Dispatch<
    React.SetStateAction<{
      status: "idle" | "loading" | "ready" | "no_connection" | "error";
      models: Array<{ id: string; name: string; contextLength?: number }>;
      errorMessage: string;
    }>
  >;
  sortedConnectionIds: string[];
  notify: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
  };
  t: (key: string, params?: Record<string, unknown>) => string;

  // Shared state helpers
  isLiveCatalogProvider: boolean;
  supportsAutoSync: boolean;
}
