export type JsonRecord = Record<string, unknown>;

export type ToolNameMap = Map<string, string> | null;

export interface ProviderCredentials extends JsonRecord {
  refreshToken?: string;
  providerSpecificData?: Record<string, unknown> | null;
  connectionId?: string;
  requestEndpointPath?: string;
}

export interface HandlerLogger {
  debug?: (tag: string, message: string) => void;
  info?: (tag: string, message: string) => void;
  warn?: (tag: string, message: string) => void;
  error?: (tag: string, message: string) => void;
}

export interface RequestLogger {
  logClientRawRequest?: (endpoint?: string, body?: unknown, headers?: unknown) => void;
  logTargetRequest?: (url?: string, headers?: unknown, body?: unknown) => void;
  logProviderResponse?: (
    status?: number,
    statusText?: string,
    headers?: unknown,
    body?: unknown
  ) => void;
  logConvertedResponse?: (body?: unknown) => void;
  logError?: (error: Error, body?: unknown) => void;
  getPipelinePayloads?: () => Record<string, unknown> | null;
}

export interface RawRequestLike {
  endpoint?: string;
  body?: unknown;
  headers?: Headers | Record<string, string | string[] | undefined> | null;
}

export interface ApiKeyInfo {
  id?: string;
  name?: string;
  noLog?: boolean;
}

export interface ModelInfo {
  provider: string;
  model: string;
  extendedContext?: boolean;
}

export interface ChatCoreContext {
  body: JsonRecord;
  modelInfo: ModelInfo;
  credentials: ProviderCredentials;
  log?: HandlerLogger | null;
  onCredentialsRefreshed?: (
    credentials: Partial<Pick<ProviderCredentials, "accessToken" | "copilotToken">>
  ) => Promise<void> | void;
  onRequestSuccess?: () => Promise<void> | void;
  onDisconnect?: () => void;
  clientRawRequest?: RawRequestLike | null;
  connectionId?: string | null;
  apiKeyInfo?: ApiKeyInfo | null;
  userAgent?: string;
  comboName?: string;
  comboStrategy?: string | null;
  isCombo?: boolean;
  combo?: JsonRecord | null;
}

export interface PersistAttemptLogsArgs {
  status: number;
  tokens?: unknown;
  responseBody?: unknown;
  error?: string | null;
  providerRequest?: unknown;
  providerResponse?: unknown;
  clientResponse?: unknown;
  claudeCacheMeta?: Record<string, unknown> | null;
  claudeCacheUsageMeta?: Record<string, unknown> | null;
}

export interface ChatCoreResult {
  success: boolean;
  response?: Response;
  status?: number;
  error?: string;
}

export interface ExecutionResult {
  response: Response;
  url?: string;
  headers?: HeadersInit;
  transformedBody?: JsonRecord;
}

export interface ProviderExecutor {
  execute: (input: {
    model: string;
    body: JsonRecord;
    stream: boolean;
    credentials: ProviderCredentials;
    signal?: AbortSignal | null;
    log?: HandlerLogger | null;
    extendedContext?: boolean;
    upstreamExtraHeaders?: Record<string, string> | null;
  }) => Promise<ExecutionResult>;
  refreshCredentials?: (
    credentials: ProviderCredentials,
    log?: HandlerLogger | null
  ) => Promise<Partial<Pick<ProviderCredentials, "accessToken" | "copilotToken">> | null>;
}

export interface ProviderExecutionState {
  providerResponse: Response;
  providerUrl?: string;
  providerHeaders?: HeadersInit;
  finalBody?: JsonRecord;
}

export interface ResolveExecutorWithProxyOptions {
  provider: string;
  log?: HandlerLogger | null;
}

export interface PersistProviderAccountErrorStateOptions {
  connectionId?: string | null;
  provider: string;
  model: string;
  statusCode: number;
  message: string;
  retryAfterMs: number | null;
}

export interface NormalizeNonStreamingTranslatedResponseOptions {
  requestBody: JsonRecord;
  responseBody: unknown;
  sourceFormat: string;
  targetFormat: string;
  stream: boolean;
  toolNameMap: ToolNameMap;
}
