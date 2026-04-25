/**
 * Normalize a model entry to { model, weight, disabled }
 * Supports both legacy string format and new object format
 */
export function normalizeModelEntry(entry: unknown): {
  model: string;
  weight: number;
  disabled: boolean;
} {
  if (typeof entry === "string") return { model: entry, weight: 0, disabled: false };
  if (!entry || typeof entry !== "object") return { model: "", weight: 0, disabled: false };

  const o = entry as Record<string, unknown>;
  const model = typeof o.model === "string" ? o.model : typeof o.value === "string" ? o.value : "";
  const parsedWeight = typeof o.weight === "number" ? o.weight : Number(o.weight) || 0;
  const disabled = typeof o.disabled === "boolean" ? o.disabled : false;

  return { model, weight: parsedWeight, disabled };
}
