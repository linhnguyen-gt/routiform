import type {
  CompatByProtocolMap,
  CompatModelMap,
  CompatModelRow,
  ModelCompatSavePatch,
} from "../types";

export interface ProviderDetailActionProps {
  // Core identifiers
  providerId: string;
  providerAlias: string;
  providerDisplayAlias: string;
  providerStorageAlias: string;

  // State & Data
  connections: any[];
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
  setConnections: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedConnectionIds: (fn: (prev: string[]) => string[]) => void;
  setOpencodeLiveCatalog: React.Dispatch<React.SetStateAction<any>>;
  sortedConnectionIds: string[];
  notify: any;
  t: any;

  // Shared state helpers
  isLiveCatalogProvider: boolean;
  supportsAutoSync: boolean;
}
