import { NextResponse } from "next/server";
import { REGISTRY } from "@routiform/open-sse/config/providerRegistry.ts";
import { getAllCustomModels, getPricing } from "@/lib/localDb";

interface ModelEntry {
  id: string;
  name: string;
  custom?: boolean;
}

interface CatalogEntry {
  id: string;
  alias?: string;
  name: string;
  authType?: string;
  format?: string;
  models?: ModelEntry[];
  modelCount?: number;
  pricing?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asModelArray(value: unknown): Array<{ id?: string; name?: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as Array<{
    id?: string;
    name?: string;
  }>;
}

/**
 * GET /api/pricing/models
 * Returns the full model catalog merged from three sources:
 *  1. providerRegistry (hardcoded)
 *  2. customModels (DB — user-added or imported via /models)
 *  3. pricing data (DB — models with pricing configured but not in sources 1/2)
 */
export async function GET() {
  try {
    const catalog: Record<string, CatalogEntry> = {};

    // ── 1. Registry models (hardcoded) ──────────────────────────────
    for (const entry of Object.values(REGISTRY)) {
      const alias = entry.alias || entry.id;
      if (!entry.models || entry.models.length === 0) continue;

      catalog[alias] = {
        id: entry.id,
        alias,
        name: entry.id.charAt(0).toUpperCase() + entry.id.slice(1),
        authType: entry.authType || "unknown",
        format: entry.format || "openai",
        models: entry.models.map((m) => ({
          id: m.id,
          name: m.name || m.id,
          custom: false,
        })),
      };
    }

    // ── 2. Custom models (DB) ───────────────────────────────────────
    let customModelsMap: Record<string, unknown> = {};
    try {
      customModelsMap = asRecord(await getAllCustomModels());
    } catch {
      /* DB may not be ready */
    }

    for (const [providerId, rawModels] of Object.entries(customModelsMap)) {
      const models = asModelArray(rawModels);
      // Resolve alias — check if a registry entry maps this providerId
      let alias = providerId;
      for (const entry of Object.values(REGISTRY)) {
        if (entry.id === providerId) {
          alias = entry.alias || entry.id;
          break;
        }
      }

      if (!catalog[alias]) {
        catalog[alias] = {
          id: providerId,
          alias,
          name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
          authType: "unknown",
          format: "openai",
          models: [],
        };
      }

      const existingModels = catalog[alias].models || [];
      const existingIds = new Set(existingModels.map((m) => m.id));
      for (const model of models) {
        const modelId = typeof model.id === "string" ? model.id : null;
        if (!modelId || existingIds.has(modelId)) {
          continue;
        }
        if (!existingIds.has(modelId)) {
          const catalogModels = catalog[alias].models || [];
          catalogModels.push({
            id: modelId,
            name: typeof model.name === "string" && model.name.trim() ? model.name : modelId,
            custom: true,
          });
          catalog[alias].models = catalogModels;
          existingIds.add(modelId);
        }
      }
    }

    // ── 3. Pricing-only models (DB) ─────────────────────────────────
    let pricingData: Record<string, unknown> = {};
    try {
      pricingData = await getPricing();
    } catch {
      /* DB may not be ready */
    }

    for (const [providerAlias, models] of Object.entries(pricingData)) {
      if (!catalog[providerAlias]) {
        catalog[providerAlias] = {
          id: providerAlias,
          alias: providerAlias,
          name: providerAlias.charAt(0).toUpperCase() + providerAlias.slice(1),
          authType: "unknown",
          format: "openai",
          models: [],
        };
      }

      const catalogModels = catalog[providerAlias].models || [];
      const existingIds = new Set(catalogModels.map((m) => m.id));
      for (const modelId of Object.keys(models)) {
        if (!existingIds.has(modelId)) {
          catalogModels.push({
            id: modelId,
            name: modelId,
            custom: true,
          });
          catalog[providerAlias].models = catalogModels;
          existingIds.add(modelId);
        }
      }
    }

    // Add modelCount to each entry
    for (const entry of Object.values(catalog)) {
      entry.modelCount = (entry.models || []).length;
    }

    return NextResponse.json(catalog);
  } catch (error) {
    console.error("Error fetching model catalog:", error);
    return NextResponse.json({ error: "Failed to fetch model catalog" }, { status: 500 });
  }
}
