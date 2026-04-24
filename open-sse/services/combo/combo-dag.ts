import { normalizeModelEntry } from "./combo-model-entry.ts";
import { MAX_COMBO_DEPTH } from "./combo-constants.ts";

export function validateComboDAG(
  comboName: string,
  allCombos: { combos?: unknown[] } | unknown[] | null | undefined,
  visited: Set<string> = new Set(),
  depth = 0
): void {
  if (depth > MAX_COMBO_DEPTH) {
    throw new Error(`Max combo nesting depth (${MAX_COMBO_DEPTH}) exceeded at "${comboName}"`);
  }
  if (visited.has(comboName)) {
    throw new Error(`Circular combo reference detected: ${comboName}`);
  }
  visited.add(comboName);

  const combos = Array.isArray(allCombos) ? allCombos : allCombos?.combos || [];
  const combo = combos.find((c: { name?: string }) => c.name === comboName) as
    | { models?: unknown[] }
    | undefined;
  if (!combo || !combo.models) return;

  for (const entry of combo.models) {
    const modelName = normalizeModelEntry(entry).model;
    const nestedCombo = combos.find((c: { name?: string }) => c.name === modelName);
    if (nestedCombo) {
      validateComboDAG(modelName, combos, new Set(visited), depth + 1);
    }
  }
}

export function resolveNestedComboModels(
  combo: { name: string; models?: unknown[] },
  allCombos: { combos?: unknown[] } | unknown[] | null | undefined,
  visited: Set<string> = new Set(),
  depth = 0
): string[] {
  if (depth > MAX_COMBO_DEPTH) {
    return (combo.models || []).map((m) => normalizeModelEntry(m).model);
  }
  if (visited.has(combo.name)) return [];
  visited.add(combo.name);

  const combos = Array.isArray(allCombos) ? allCombos : allCombos?.combos || [];
  const resolved: string[] = [];

  for (const entry of combo.models || []) {
    const modelName = normalizeModelEntry(entry).model;
    const nestedCombo = combos.find((c: { name?: string }) => c.name === modelName) as
      | { name: string; models?: unknown[] }
      | undefined;

    if (nestedCombo) {
      const nested = resolveNestedComboModels(nestedCombo, combos, new Set(visited), depth + 1);
      resolved.push(...nested);
    } else {
      resolved.push(modelName);
    }
  }

  return resolved;
}
