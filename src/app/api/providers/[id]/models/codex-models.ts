import type { JsonRecord } from "./json-types";
import { asRecord } from "./json-utils";

const DEFAULT_CODEX_MODELS_BASE_URL = "https://chatgpt.com/backend-api/codex";
export const DEFAULT_CODEX_CLIENT_VERSION = "0.92.0";
const DISABLED_CODEX_MODEL_IDS = new Set(["gpt-oss-120b", "gpt-oss-20b"]);
const CODEX_ALLOWED_MODELS = ["gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.2"] as const;
const CODEX_ALLOWED_MODEL_IDS = new Set<string>(CODEX_ALLOWED_MODELS);
const CODEX_MODEL_DISPLAY_NAMES: Record<(typeof CODEX_ALLOWED_MODELS)[number], string> = {
  "gpt-5.4": "gpt-5.4",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5.3-codex": "gpt-5.3-codex",
  "gpt-5.2": "gpt-5.2",
};

function getDefaultCodexModels(): Array<JsonRecord> {
  return CODEX_ALLOWED_MODELS.map((id) => ({
    id,
    name: CODEX_MODEL_DISPLAY_NAMES[id],
    hidden: false,
    owned_by: "codex",
  }));
}

export function mergeCodexModels(models: Array<JsonRecord>): Array<JsonRecord> {
  const mergedById = new Map<string, JsonRecord>();

  for (const model of getDefaultCodexModels()) {
    mergedById.set(String(model.id), model);
  }

  for (const model of models) {
    const id = typeof model.id === "string" ? model.id : "";
    if (!CODEX_ALLOWED_MODEL_IDS.has(id)) continue;
    mergedById.set(id, {
      ...mergedById.get(id),
      ...model,
      id,
      name: CODEX_MODEL_DISPLAY_NAMES[id as (typeof CODEX_ALLOWED_MODELS)[number]],
      hidden: false,
      owned_by: "codex",
    });
  }

  return CODEX_ALLOWED_MODELS.map((id) => mergedById.get(id)).filter((m): m is JsonRecord =>
    Boolean(m)
  );
}

export function normalizeCodexModelsBaseUrl(baseUrl: string | null): string {
  let normalized = (baseUrl || DEFAULT_CODEX_MODELS_BASE_URL).trim().replace(/\/$/, "");
  if (normalized.endsWith("/responses")) {
    normalized = normalized.slice(0, -10);
  }
  return normalized;
}

export function buildCodexModelsEndpoints(baseUrl: string): string[] {
  const endpoints = [`${baseUrl}/models`, `${baseUrl}/v1/models`, `${baseUrl}/api/codex/models`];
  return [...new Set(endpoints)];
}

export function mapCodexModelsFromApi(data: unknown, includeHidden: boolean): Array<JsonRecord> {
  const record = asRecord(data);
  const rawModels = Array.isArray(record.models)
    ? record.models
    : Array.isArray(record.data)
      ? record.data
      : [];

  const mapped = rawModels
    .map((item) => {
      const model = asRecord(item);
      const id = String(model.id || model.slug || model.model || "").trim();
      if (!id) return null;

      const visibility = typeof model.visibility === "string" ? model.visibility : null;
      const hidden = visibility !== null ? visibility !== "list" : Boolean(model.hidden);

      return {
        ...model,
        id,
        name:
          (typeof model.name === "string" && model.name) ||
          (typeof model.display_name === "string" && model.display_name) ||
          (typeof model.displayName === "string" && model.displayName) ||
          id,
        hidden,
        owned_by: "codex",
      };
    })
    .filter((model) => model !== null) as Array<JsonRecord>;

  const withoutDisabled = mapped.filter((model) => {
    const id = typeof model.id === "string" ? model.id : "";
    return !DISABLED_CODEX_MODEL_IDS.has(id) && CODEX_ALLOWED_MODEL_IDS.has(id);
  });
  const visible = includeHidden
    ? withoutDisabled
    : withoutDisabled.filter((model) => model.hidden !== true);

  return mergeCodexModels(visible);
}
