import { asRecord } from "./json-utils";

export function normalizeModelKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function buildClineCategorySets(data: unknown): {
  recommended: Set<string>;
  free: Set<string>;
} {
  const record = asRecord(data);
  const collect = (input: unknown) => {
    if (!Array.isArray(input)) return [] as string[];
    return input
      .map((item) => {
        const row = asRecord(item);
        return normalizeModelKey(row.id || row.modelId || row.name);
      })
      .filter((id) => id.length > 0);
  };

  return {
    recommended: new Set(collect(record.recommended)),
    free: new Set(collect(record.free)),
  };
}
