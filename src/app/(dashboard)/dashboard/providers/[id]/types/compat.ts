import { type ModelCompatProtocolKey } from "@/shared/constants/modelCompat";

export type CompatByProtocolMap = Partial<
  Record<
    ModelCompatProtocolKey,
    {
      normalizeToolCallId?: boolean;
      preserveOpenAIDeveloperRole?: boolean;
      upstreamHeaders?: Record<string, string>;
    }
  >
>;

export type ModelCompatSavePatch = {
  normalizeToolCallId?: boolean;
  preserveOpenAIDeveloperRole?: boolean;
  upstreamHeaders?: Record<string, string>;
  compatByProtocol?: CompatByProtocolMap;
};

export type CompatModelRow = {
  id?: string;
  name?: string;
  source?: string;
  apiFormat?: string;
  supportedEndpoints?: string[];
  normalizeToolCallId?: boolean;
  preserveOpenAIDeveloperRole?: boolean;
  upstreamHeaders?: Record<string, string>;
  compatByProtocol?: CompatByProtocolMap;
};

export type CompatModelMap = Map<string, CompatModelRow>;

export type HeaderDraftRow = { id: string; name: string; value: string };

export type ProviderModelsApiErrorBody = {
  error?: {
    message?: string;
    details?: Array<{ field?: string; message?: string }>;
  };
};
