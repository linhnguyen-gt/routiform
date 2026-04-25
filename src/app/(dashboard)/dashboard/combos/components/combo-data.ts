import {
  type ComboModelEntry,
  type ComboRecord,
  type ComboTestResults,
  type ProviderNode,
} from "./combo-types";

export function hasTranslation(t: { has?: (key: string) => boolean }, key: string): boolean {
  return typeof t.has === "function" && t.has(key);
}

export function normalizeModelEntry(entry: string | ComboModelEntry): Required<ComboModelEntry> {
  if (typeof entry === "string") return { model: entry, weight: 0, disabled: false };
  if (!entry || typeof entry !== "object") return { model: "", weight: 0, disabled: false };

  const model =
    typeof entry.model === "string"
      ? entry.model
      : "value" in entry && typeof entry.value === "string"
        ? entry.value
        : "";
  const parsedWeight = typeof entry.weight === "number" ? entry.weight : Number(entry.weight) || 0;
  const disabled = typeof entry.disabled === "boolean" ? entry.disabled : false;

  return { model, weight: parsedWeight, disabled };
}

export function getModelString(entry: string | ComboModelEntry): string {
  return typeof entry === "string" ? entry : entry.model;
}

export function normalizeComboRecord(combo: ComboRecord | null): ComboRecord | null {
  if (!combo) return null;
  return {
    ...combo,
    models: (combo.models || []).map((model) =>
      typeof model === "string" ? model : normalizeModelEntry(model)
    ),
  };
}

export function getProviderDisplayName(modelValue: string, providerNodes: ProviderNode[]): string {
  if (!modelValue || typeof modelValue !== "string") return modelValue || "";
  const parts = modelValue.split("/");
  if (parts.length !== 2) return modelValue;
  const [providerIdentifier, modelId] = parts;
  const matchedNode = providerNodes.find(
    (node) => node.id === providerIdentifier || node.prefix === providerIdentifier
  );
  return matchedNode?.name ? `${matchedNode.name}/${modelId}` : modelValue;
}

export function getTestResultsItems(results: ComboTestResults): ComboTestResults["results"] {
  return Array.isArray(results.results) ? results.results : [];
}
