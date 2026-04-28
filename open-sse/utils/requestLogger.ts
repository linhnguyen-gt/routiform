type JsonRecord = Record<string, unknown>;
const DEFAULT_MAX_STREAM_CHUNK_BYTES = 128 * 1024;
const DEFAULT_MAX_STREAM_CHUNK_ITEMS = 512;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

type HeaderInput =
  | Headers
  | Record<string, unknown>
  | { entries?: () => IterableIterator<[string, string]> }
  | null
  | undefined;

export type RequestPipelinePayloads = {
  clientRawRequest?: JsonRecord;
  openaiRequest?: JsonRecord;
  providerRequest?: JsonRecord;
  providerResponse?: JsonRecord;
  clientResponse?: JsonRecord;
  error?: JsonRecord;
  streamChunks?: {
    provider?: string[];
    openai?: string[];
    client?: string[];
  };
  contextValidation?: {
    originalTokens: number;
    limit: number;
    exceeded: number;
    compressed?: boolean;
    finalTokens?: number;
    layers?: string[];
    rejected?: boolean;
    timestamp: string;
  };
};

type RequestLogger = {
  sessionPath: null;
  logClientRawRequest: (endpoint: unknown, body: unknown, headers?: HeaderInput) => void;
  logOpenAIRequest: (body: unknown) => void;
  logTargetRequest: (url: unknown, headers: HeaderInput, body: unknown) => void;
  logProviderResponse: (
    status: unknown,
    statusText: unknown,
    headers: HeaderInput,
    body: unknown
  ) => void;
  appendProviderChunk: (chunk: string) => void;
  appendOpenAIChunk: (chunk: string) => void;
  logConvertedResponse: (body: unknown) => void;
  appendConvertedChunk: (chunk: string) => void;
  logContextValidation: (validation: {
    originalTokens: number;
    limit: number;
    exceeded: number;
    compressed?: boolean;
    finalTokens?: number;
    layers?: string[];
    rejected?: boolean;
  }) => void;
  logError: (error: unknown, requestBody?: unknown) => void;
  getPipelinePayloads: () => RequestPipelinePayloads | null;
};

function maskSensitiveHeaders(headers: HeaderInput): Record<string, unknown> {
  if (!headers) return {};

  const headerEntries: Record<string, unknown> = {};
  if (headers && typeof (headers as Headers).forEach === "function") {
    (headers as Headers).forEach((value, key) => {
      headerEntries[key] = value;
    });
  } else if (
    headers &&
    typeof (headers as { entries?: () => Iterable<[string, unknown]> }).entries === "function"
  ) {
    for (const [key, value] of (
      headers as { entries: () => Iterable<[string, unknown]> }
    ).entries()) {
      headerEntries[key] = value;
    }
  } else {
    Object.assign(headerEntries, headers as Record<string, unknown>);
  }

  const masked = { ...headerEntries };
  const sensitiveKeys = ["authorization", "x-api-key", "cookie", "token"];

  for (const key of Object.keys(masked)) {
    const lowerKey = key.toLowerCase();
    if (!sensitiveKeys.some((candidate) => lowerKey.includes(candidate))) {
      continue;
    }

    const value = masked[key];
    if (typeof value === "string" && value.length > 20) {
      masked[key] = `${value.slice(0, 10)}...${value.slice(-5)}`;
    } else if (value) {
      masked[key] = "[REDACTED]";
    }
  }

  return masked;
}

function createEmptyStreamChunks() {
  return {
    provider: [] as string[],
    openai: [] as string[],
    client: [] as string[],
  };
}

function appendBoundedChunk(
  chunks: string[],
  chunk: string,
  maxBytes: number,
  maxItems: number
): void {
  if (typeof chunk !== "string" || chunk.length === 0) return;
  if (chunks.some((entry) => entry.includes("[stream chunk log truncated"))) return;

  if (chunks.length >= maxItems) {
    const marker = `[stream chunk log truncated after ${maxItems} chunks]`;
    chunks[maxItems - 1] = marker;
    return;
  }

  const currentBytes = UTF8_ENCODER.encode(chunks.join("")).length;
  if (currentBytes >= maxBytes) {
    if (chunks.length < maxItems) {
      chunks.push(`[stream chunk log truncated after ${maxBytes} bytes]`);
    }
    return;
  }

  const remainingBytes = maxBytes - currentBytes;
  const chunkBytes = UTF8_ENCODER.encode(chunk).length;
  if (chunkBytes <= remainingBytes) {
    chunks.push(chunk);
    return;
  }

  const encoded = UTF8_ENCODER.encode(chunk);
  const truncated = UTF8_DECODER.decode(encoded.subarray(0, remainingBytes));
  chunks.push(truncated);
  if (chunks.length < maxItems) {
    chunks.push(`[stream chunk log truncated after ${maxBytes} bytes]`);
  }
}

function hasOwnValues(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && Object.keys(value as JsonRecord).length > 0);
}

function compactPipelinePayloads(
  payloads: RequestPipelinePayloads
): RequestPipelinePayloads | null {
  const result: RequestPipelinePayloads = {};

  for (const [key, value] of Object.entries(payloads)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (key === "streamChunks" && value && typeof value === "object") {
      const chunkRecord = value as Record<string, unknown>;
      const compactedChunks = Object.fromEntries(
        Object.entries(chunkRecord).filter(
          ([, chunkValue]) => Array.isArray(chunkValue) && chunkValue.length > 0
        )
      );
      if (Object.keys(compactedChunks).length > 0) {
        result.streamChunks = compactedChunks as RequestPipelinePayloads["streamChunks"];
      }
      continue;
    }

    result[key as keyof RequestPipelinePayloads] = value as never;
  }

  return hasOwnValues(result) ? result : null;
}

function _createNoOpLogger(): RequestLogger {
  return {
    sessionPath: null,
    logClientRawRequest() {},
    logOpenAIRequest() {},
    logTargetRequest() {},
    logProviderResponse() {},
    appendProviderChunk() {},
    appendOpenAIChunk() {},
    logConvertedResponse() {},
    appendConvertedChunk() {},
    logContextValidation() {},
    logError() {},
    getPipelinePayloads() {
      return null;
    },
  };
}

export async function createRequestLogger(
  _sourceFormat?: string,
  _targetFormat?: string,
  _model?: string,
  options: { maxStreamChunkBytes?: number; maxStreamChunkItems?: number } = {}
): Promise<RequestLogger> {
  const maxStreamChunkBytes =
    Number.isInteger(options.maxStreamChunkBytes) && Number(options.maxStreamChunkBytes) > 0
      ? Number(options.maxStreamChunkBytes)
      : DEFAULT_MAX_STREAM_CHUNK_BYTES;
  const maxStreamChunkItems =
    Number.isInteger(options.maxStreamChunkItems) && Number(options.maxStreamChunkItems) > 0
      ? Number(options.maxStreamChunkItems)
      : DEFAULT_MAX_STREAM_CHUNK_ITEMS;

  const streamChunks = createEmptyStreamChunks();
  const payloads: RequestPipelinePayloads = {
    streamChunks,
  };

  return {
    sessionPath: null,

    logClientRawRequest(endpoint, body, headers = {}) {
      payloads.clientRawRequest = {
        timestamp: new Date().toISOString(),
        endpoint,
        headers: maskSensitiveHeaders(headers),
        body,
      };
    },

    logOpenAIRequest(body) {
      payloads.openaiRequest = {
        timestamp: new Date().toISOString(),
        body,
      };
    },

    logTargetRequest(url, headers, body) {
      payloads.providerRequest = {
        timestamp: new Date().toISOString(),
        url,
        headers: maskSensitiveHeaders(headers),
        body,
      };
    },

    logProviderResponse(status, statusText, headers, body) {
      payloads.providerResponse = {
        timestamp: new Date().toISOString(),
        status,
        statusText,
        headers: maskSensitiveHeaders(headers),
        body,
      };
    },

    appendProviderChunk(chunk) {
      appendBoundedChunk(streamChunks.provider, chunk, maxStreamChunkBytes, maxStreamChunkItems);
    },

    appendOpenAIChunk(chunk) {
      appendBoundedChunk(streamChunks.openai, chunk, maxStreamChunkBytes, maxStreamChunkItems);
    },

    logConvertedResponse(body) {
      payloads.clientResponse = {
        timestamp: new Date().toISOString(),
        body,
      };
    },

    appendConvertedChunk(chunk) {
      appendBoundedChunk(streamChunks.client, chunk, maxStreamChunkBytes, maxStreamChunkItems);
    },

    logError(error, requestBody = null) {
      payloads.error = {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestBody,
      };
    },

    logContextValidation(validation) {
      payloads.contextValidation = {
        ...validation,
        timestamp: new Date().toISOString(),
      };
    },

    getPipelinePayloads() {
      return compactPipelinePayloads(payloads);
    },
  };
}

export function logError(_provider: string, _entry: unknown) {}
