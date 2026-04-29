type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

// GitHub Copilot chat API accepts large tool lists; upstream parity uses 128 as a safe ceiling
// before provider 400s. Keep conservative token caps elsewhere (Haiku + tools).
const GITHUB_MAX_TOOLS = 128;
const GITHUB_MAX_TOKENS_DEFAULT = 8192;
const GITHUB_MAX_TOKENS_HAIKU_WITH_TOOLS = 4096;

const SCHEMA_META_KEYS = new Set(["description", "title", "$comment", "examples"]);

function pruneSchemaMeta(value: JsonValue, inPropertyMap = false): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => pruneSchemaMeta(item)) as JsonValue;
  }

  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, JsonValue>;
  const result: Record<string, JsonValue> = {};

  for (const [key, nested] of Object.entries(record)) {
    if (!inPropertyMap && SCHEMA_META_KEYS.has(key)) continue;

    const nextIsPropertyMap =
      key === "properties" ||
      key === "patternProperties" ||
      key === "$defs" ||
      key === "definitions";

    result[key] = pruneSchemaMeta(nested, nextIsPropertyMap);
  }

  return result as JsonValue;
}

function getToolName(tool: unknown): string {
  if (!tool || typeof tool !== "object") return "";
  const record = tool as Record<string, unknown>;
  if (record.type === "function" && record.function && typeof record.function === "object") {
    const fn = record.function as Record<string, unknown>;
    return typeof fn.name === "string" ? fn.name : "";
  }
  return typeof record.name === "string" ? record.name : "";
}

function getRequiredToolName(toolChoice: unknown): string {
  if (!toolChoice || typeof toolChoice !== "object") return "";
  const choice = toolChoice as Record<string, unknown>;
  if (choice.type !== "function" || !choice.function || typeof choice.function !== "object") {
    return "";
  }
  const fn = choice.function as Record<string, unknown>;
  return typeof fn.name === "string" ? fn.name : "";
}

export function optimizeGithubRequestBody(
  body: Record<string, unknown>,
  modelId: string
): { actions: string[] } {
  const actions: string[] = [];

  const tools = Array.isArray(body.tools) ? body.tools : null;
  const hasTools = Array.isArray(tools) && tools.length > 0;
  const isHaiku = /\bhaiku\b|\/haiku|claude-haiku/i.test((modelId || "").toLowerCase());

  const tokenCap =
    isHaiku && hasTools ? GITHUB_MAX_TOKENS_HAIKU_WITH_TOOLS : GITHUB_MAX_TOKENS_DEFAULT;

  for (const field of ["max_tokens", "max_completion_tokens"] as const) {
    const value = body[field];
    if (typeof value === "number" && Number.isFinite(value) && value > tokenCap) {
      body[field] = tokenCap;
      actions.push(`cap_${field}_${tokenCap}`);
    }
  }

  if (
    typeof body.max_tokens !== "number" &&
    typeof body.max_completion_tokens !== "number" &&
    hasTools
  ) {
    body.max_tokens = tokenCap;
    actions.push(`set_max_tokens_${tokenCap}`);
  }

  if (!Array.isArray(tools) || tools.length === 0) {
    return { actions };
  }

  const strippedTools = tools.map((tool) => pruneSchemaMeta(tool as JsonValue));
  body.tools = strippedTools;
  actions.push("strip_tool_schema_meta");

  if (strippedTools.length > GITHUB_MAX_TOOLS) {
    const requiredToolName = getRequiredToolName(body.tool_choice);
    const limitedTools = strippedTools.slice(0, GITHUB_MAX_TOOLS);

    if (requiredToolName) {
      const hasRequiredTool = limitedTools.some((tool) => getToolName(tool) === requiredToolName);
      if (!hasRequiredTool) {
        const requiredTool = strippedTools.find((tool) => getToolName(tool) === requiredToolName);
        if (requiredTool) {
          limitedTools[limitedTools.length - 1] = requiredTool;
        }
      }
    }

    body.tools = limitedTools;
    actions.push(`truncate_tools_${GITHUB_MAX_TOOLS}`);
  }

  return { actions };
}
