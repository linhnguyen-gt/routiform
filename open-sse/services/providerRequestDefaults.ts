type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export type ProviderRequestDefaults = {
  serviceTier?: string;
  reasoningEffort?: string;
  thinking?: JsonRecord;
};

export function applyProviderRequestDefaults(
  body: unknown,
  defaults?: ProviderRequestDefaults
): unknown {
  if (!defaults || typeof defaults !== "object") return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;

  const payload = { ...(body as JsonRecord) };

  if (defaults.serviceTier !== undefined && payload.service_tier === undefined) {
    payload.service_tier = defaults.serviceTier;
  }

  if (defaults.reasoningEffort !== undefined) {
    // Check both reasoning.effort (nested) and reasoning_effort (flat)
    const reasoning = asRecord(payload.reasoning);
    const hasNestedEffort = reasoning.effort !== undefined;
    const hasFlatEffort = payload.reasoning_effort !== undefined;

    if (!hasNestedEffort && !hasFlatEffort) {
      payload.reasoning = {
        ...reasoning,
        effort: defaults.reasoningEffort,
      };
    }
  }

  if (defaults.thinking !== undefined && payload.thinking === undefined) {
    payload.thinking = defaults.thinking;
  }

  return payload;
}
