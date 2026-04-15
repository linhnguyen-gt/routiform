/**
 * opencodeGoModelsCatalog.ts — Fetch opencode-go model catalog from models.dev
 *
 * Provides live model list for opencode-go provider in dashboard UI.
 * Source: https://models.dev/api.json
 * Fallback: static curated list if fetch/parse fails.
 */

// Simple logger for this module
const logger = {
  info: (msg: string) => console.log(`[opencodeGoModelsCatalog] ${msg}`),
  warn: (msg: string) => console.warn(`[opencodeGoModelsCatalog] ${msg}`),
};

// ─── Types ───────────────────────────────────────────────

interface ModelsDevModel {
  id: string;
  name: string;
  limit?: {
    context?: number;
  };
}

interface ModelsDevProvider {
  id: string;
  models: Record<string, ModelsDevModel>;
}

interface ModelsDevResponse {
  providers: Record<string, ModelsDevProvider>;
}

export interface OpencodeGoModel {
  id: string;
  name: string;
  contextLength?: number;
}

// ─── Cache ───────────────────────────────────────────────

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MODELS_DEV_API_URL = "https://models.dev/api.json";

let cachedModels: OpencodeGoModel[] | null = null;
let cacheTimestamp = 0;

// ─── Static Fallback ─────────────────────────────────────

const STATIC_FALLBACK_MODELS: OpencodeGoModel[] = [
  { id: "glm-5", name: "GLM-5" },
  { id: "kimi-k2.5", name: "Kimi K2.5" },
  { id: "mimo-v2-pro", name: "MiMo-V2-Pro" },
  { id: "mimo-v2-omni", name: "MiMo-V2-Omni" },
  { id: "minimax-m2.7", name: "MiniMax M2.7" },
  { id: "minimax-m2.5", name: "MiniMax M2.5" },
];

// ─── Fetch & Parse ───────────────────────────────────────

async function fetchModelsDevData(): Promise<OpencodeGoModel[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(MODELS_DEV_API_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Routiform/3.9.1",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`models.dev fetch failed [${response.status}]`);
    }

    const data = (await response.json()) as ModelsDevResponse;

    if (!data.providers || typeof data.providers !== "object") {
      throw new Error("models.dev response missing providers object");
    }

    const opencodeGoProvider = data.providers["opencode-go"];

    if (!opencodeGoProvider || !opencodeGoProvider.models) {
      logger.warn("models.dev: opencode-go provider not found or has no models");
      return STATIC_FALLBACK_MODELS;
    }

    const models: OpencodeGoModel[] = Object.values(opencodeGoProvider.models).map((m) => ({
      id: m.id,
      name: m.name,
      contextLength: m.limit?.context,
    }));

    if (models.length === 0) {
      logger.warn("models.dev: opencode-go returned 0 models, using fallback");
      return STATIC_FALLBACK_MODELS;
    }

    logger.info(`models.dev: fetched ${models.length} models for opencode-go`);
    return models;
  } catch (error) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`models.dev fetch failed: ${message}, using fallback`);
    return STATIC_FALLBACK_MODELS;
  }
}

// ─── Public API ──────────────────────────────────────────

/**
 * Get opencode-go model catalog with memory cache.
 * Falls back to static list on error.
 */
export async function getOpencodeGoModels(): Promise<OpencodeGoModel[]> {
  const now = Date.now();

  if (cachedModels && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedModels;
  }

  const models = await fetchModelsDevData();
  cachedModels = models;
  cacheTimestamp = now;

  return models;
}

/**
 * Force refresh cache (used by dashboard refresh button).
 */
export async function refreshOpencodeGoModels(): Promise<OpencodeGoModel[]> {
  cachedModels = null;
  cacheTimestamp = 0;
  return getOpencodeGoModels();
}

/**
 * Get static fallback list (for testing/comparison).
 */
export function getOpencodeGoStaticModels(): OpencodeGoModel[] {
  return STATIC_FALLBACK_MODELS;
}
