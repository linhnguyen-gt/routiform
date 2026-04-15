import type { AccessSchedule } from "../types";

// ---------------------------------------------------------------------------
// PermissionsState - return type of usePermissionsState
// ---------------------------------------------------------------------------

export interface PermissionsState {
  // Model selection state
  selectedModels: string[];
  allowAll: boolean;
  handleToggleModel: (modelId: string) => void;
  handleToggleProvider: (provider: string, models: import("../types").Model[]) => void;
  handleSelectAll: () => void;
  handleRestrictMode: () => void;
  handleSelectAllModels: () => void;
  handleDeselectAllModels: () => void;

  // Connection selection state
  selectedConnections: string[];
  allowAllConnections: boolean;
  handleToggleConnection: (connectionId: string) => void;
  setAllowAllConnections: (v: boolean) => void;
  setSelectedConnections: (v: string[]) => void;

  // Toggle state
  noLogEnabled: boolean;
  setNoLogEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  autoResolveEnabled: boolean;
  setAutoResolveEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  keyIsActive: boolean;
  setKeyIsActive: (v: boolean | ((prev: boolean) => boolean)) => void;
  maxSessions: number;
  setMaxSessions: (v: number) => void;

  // Schedule state
  scheduleEnabled: boolean;
  setScheduleEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  scheduleFrom: string;
  setScheduleFrom: (v: string) => void;
  scheduleUntil: string;
  setScheduleUntil: (v: string) => void;
  scheduleDays: number[];
  setScheduleDays: (v: number[] | ((prev: number[]) => number[])) => void;
  scheduleTz: string;
  setScheduleTz: (v: string) => void;

  // Expand/collapse state
  expandedProviders: Set<string>;
  handleToggleExpand: (provider: string) => void;

  // Derived
  selectedCount: number;

  // Save handler builder
  buildSavePayload: () => {
    allowedModels: string[];
    noLog: boolean;
    allowedConnections: string[];
    autoResolve: boolean;
    isActive: boolean;
    maxSessions: number;
    accessSchedule: AccessSchedule | null;
  };
}
