export type TranslationValues = Record<string, string | number | boolean | Date>;

export type CloudflaredTunnelPhase =
  | "unsupported"
  | "not_installed"
  | "stopped"
  | "starting"
  | "running"
  | "error";

export type EndpointModel = {
  id: string;
  name?: string;
  owned_by?: string;
  type?: string;
  subtype?: string;
  parent?: string | null;
  custom?: boolean;
};

export type SearchProvider = {
  id: string;
  name: string;
  status: "active" | "no_credentials";
  cost_per_query?: number;
};

export type CloudflaredTunnelStatus = {
  supported: boolean;
  installed: boolean;
  managedInstall: boolean;
  installSource: string | null;
  binaryPath: string | null;
  running: boolean;
  pid: number | null;
  publicUrl: string | null;
  apiUrl: string | null;
  targetUrl: string;
  phase: CloudflaredTunnelPhase;
  lastError: string | null;
  logPath: string;
};

export type TunnelNotice = {
  type: "success" | "error" | "info";
  message: string;
};

export type EndpointData = {
  chat: EndpointModel[];
  embeddings: EndpointModel[];
  images: EndpointModel[];
  rerank: EndpointModel[];
  audioTranscription: EndpointModel[];
  audioSpeech: EndpointModel[];
  moderation: EndpointModel[];
  music: EndpointModel[];
};

export type McpStatus = {
  online?: boolean;
  activity?: { recentCount?: number; windowMins?: number; lastCallAt?: string };
  heartbeat?: {
    toolCount?: number;
  } | null;
};

export type A2AStatus = {
  status?: string;
  tasks?: {
    total?: number;
    activeStreams?: number;
  } | null;
};

export type CloudStatus = {
  type: "success" | "warning" | "error";
  message: string;
};
