/**
 * Provider page domain types
 */

export interface Connection {
  id: string;
  provider: string;
  authType: "oauth" | "apikey" | "free";
  testStatus?: "active" | "success" | "error" | "expired" | "unavailable";
  isActive?: boolean;
  lastError?: string;
  lastErrorType?: string;
  lastErrorAt?: string;
  errorCode?: string;
  rateLimitedUntil?: string | null;
}

export interface ProviderNode {
  id: string;
  name: string;
  type: "openai-compatible" | "anthropic-compatible";
  apiType?: "chat" | "responses";
  compatMode?: "cc";
}

export interface ExpirationEntry {
  provider: string;
  status: "expired" | "expiring_soon";
}

export interface ExpirationData {
  summary: {
    expired: number;
    expiringSoon: number;
  };
  list: ExpirationEntry[];
}

export interface ProviderStats {
  connected: number;
  error: number;
  warning: number;
  total: number;
  errorCode: string | null;
  errorTime: string | null;
  allDisabled: boolean;
  expiryStatus: "expired" | "expiring_soon" | null;
  [key: string]: unknown;
}

export interface TestResult {
  connectionId: string;
  connectionName: string;
  provider: string;
  valid: boolean;
  latencyMs?: number;
  diagnosis?: {
    type: string;
  };
}

export interface TestResults {
  mode?: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  } | null;
  error?: string | { message?: string; error?: string };
}

export interface CompatibleProviderInfo {
  id: string;
  name: string;
  color: string;
  textIcon: string;
  apiType?: "chat" | "responses";
}

export interface ProviderCardProps {
  providerId: string;
  provider: {
    id: string;
    name: string;
    color: string;
    textIcon?: string;
  };
  stats: ProviderStats;
  authType: "oauth" | "apikey" | "free" | "compatible";
  onToggle: (active: boolean) => void;
}

export interface ApiKeyProviderCardProps {
  providerId: string;
  provider: {
    id: string;
    name: string;
    color: string;
    textIcon?: string;
    apiType?: string;
  };
  stats: ProviderStats;
  authType: "oauth" | "apikey" | "free" | "compatible";
  onToggle: (active: boolean) => void;
}

export interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (node: ProviderNode) => void;
}

export interface ProviderTestResultsViewProps {
  results: TestResults;
}

export interface ExpirationBannerProps {
  expirations: ExpirationData;
}
