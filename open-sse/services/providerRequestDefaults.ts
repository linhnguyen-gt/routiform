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
    const reasoning = asRecord(payload.reasoning);
    if (reasoning.effort === undefined) {
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
