export interface QuotaSnapshotRow {
  id: number;
  provider: string;
  connection_id: string;
  window_key: string;
  remaining_percentage: number | null;
  is_exhausted: number;
  next_reset_at: string | null;
  window_duration_ms: number | null;
  raw_data: string | null;
  created_at: string;
}

export interface ProviderUtilizationPoint {
  timestamp: string;
  provider: string;
  remainingPct: number;
  isExhausted: boolean;
  windowKey: string;
}

export interface ProviderUtilizationResponse {
  timeRange: "1h" | "24h" | "7d" | "30d";
  bucketSizeMinutes: number;
  providers: string[];
  data: ProviderUtilizationPoint[];
}

export interface ComboHealthMetrics {
  comboId: string;
  comboName: string;
  strategy: string;
  models: string[];
  quotaHealth: {
    providers: Array<{
      provider: string;
      name: string;
      remainingPct: number;
      isExhausted: boolean;
      share: number;
      trend: "improving" | "stable" | "declining";
    }>;
    worstRemainingPct: number;
  };
  usageSkew: {
    modelDistribution: Array<{
      model: string;
      requestShare: number;
      tokenShare: number;
    }>;
    giniCoefficient: number;
  };
  performance: {
    avgLatencyMs: number;
    successRate: number;
    totalRequests: number;
  };
}

export interface ComboHealthResponse {
  timeRange: "1h" | "24h" | "7d" | "30d";
  combos: ComboHealthMetrics[];
}

export type UtilizationTimeRange = "1h" | "24h" | "7d" | "30d";

export const BUCKET_SIZES: Record<UtilizationTimeRange, number> = {
  "1h": 1,
  "24h": 10,
  "7d": 60,
  "30d": 360,
};
