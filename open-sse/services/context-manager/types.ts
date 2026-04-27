export type JsonRecord = Record<string, unknown>;

export type ContextCompressionLayerStat = {
  name: string;
  tokens: number;
  tokensRemoved?: number;
  details?: Record<string, number | boolean>;
};

/** Token counts and which compression layers ran (empty `layers` when none ran). */
export type CompressContextStats = {
  original: number;
  final: number;
  layers: ContextCompressionLayerStat[];
  droppedMessageCount?: number;
  truncatedToolCount?: number;
  compressedThinkingCount?: number;
  summaryInserted?: boolean;
  systemTruncated?: boolean;
};
