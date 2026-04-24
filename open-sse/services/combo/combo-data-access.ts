import { normalizeModelEntry } from "./combo-model-entry.ts";

export function getComboFromData(
  modelStr: string,
  combosData: { combos?: unknown[] } | unknown[] | null | undefined
): { name: string; models: unknown[] } | null {
  const combos = Array.isArray(combosData) ? combosData : combosData?.combos || [];
  const combo = combos.find((c: { name?: string }) => c.name === modelStr) as
    | { name: string; models: unknown[] }
    | undefined;
  if (combo && combo.models && combo.models.length > 0) {
    return combo;
  }
  return null;
}

/** Legacy: Get combo models as string array (backward compat) */
export function getComboModelsFromData(
  modelStr: string,
  combosData: { combos?: unknown[] } | unknown[] | null | undefined
): string[] | null {
  const combo = getComboFromData(modelStr, combosData);
  if (!combo) return null;
  return combo.models.map((m) => normalizeModelEntry(m).model);
}
