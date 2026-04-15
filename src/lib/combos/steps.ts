/**
 * Combo step normalization utilities
 */

export interface ComboRefStep {
  kind: "combo-ref";
  comboName: string;
}

interface NormalizeComboStepOptions {
  comboName: string;
  index: number;
  allCombos: Set<string>;
}

/**
 * Normalizes legacy string-based combo references to structured combo-ref objects.
 * Legacy format: "combo:ComboName" or just "ComboName" if it matches an existing combo.
 */
export function normalizeComboStep(
  rawStep: string,
  options: NormalizeComboStepOptions
): ComboRefStep | null {
  const trimmed = rawStep.trim();
  if (!trimmed) return null;

  // Handle "combo:ComboName" format
  if (trimmed.startsWith("combo:")) {
    const comboName = trimmed.slice(6).trim();
    if (!comboName) return null;
    return {
      kind: "combo-ref",
      comboName,
    };
  }

  // Handle plain combo name if it exists in allCombos
  if (options.allCombos.has(trimmed)) {
    return {
      kind: "combo-ref",
      comboName: trimmed,
    };
  }

  return null;
}
