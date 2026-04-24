import { normalizeModelEntry } from "./combo-model-entry.ts";

export function selectWeightedModel(models: unknown[]): string {
  const entries = models.map((m) => normalizeModelEntry(m));
  const totalWeight = entries.reduce((sum, m) => sum + m.weight, 0);

  if (totalWeight <= 0) {
    return entries[Math.floor(Math.random() * entries.length)].model;
  }

  let random = Math.random() * totalWeight;
  for (const entry of entries) {
    random -= entry.weight;
    if (random <= 0) return entry.model;
  }
  return entries[entries.length - 1].model;
}

/** Order models for weighted fallback (selected first, then by descending weight) */
export function orderModelsForWeightedFallback(models: unknown[], selectedModel: string): string[] {
  const entries = models.map((m) => normalizeModelEntry(m));
  const selected = entries.find((e) => e.model === selectedModel);
  const rest = entries.filter((e) => e.model !== selectedModel).sort((a, b) => b.weight - a.weight);

  return [selected, ...rest].filter(Boolean).map((e) => e!.model);
}
