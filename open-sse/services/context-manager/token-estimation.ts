import type { JsonRecord } from "./types.ts";
import { getEffectiveContextLimit, getSafeLimit } from "./token-limits.ts";

const CHARS_PER_TOKEN: Record<string, number> = {
  text: 4.0,
  code: 3.0,
  json: 1.8,
  tool_result: 1.8,
  schema: 2.5,
  default: 3.5,
};

export function detectContentType(
  str: string
): "text" | "code" | "json" | "tool_result" | "schema" {
  if (str.length === 0) return "text";
  const trimmed = str.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const obj = JSON.parse(trimmed);
      if (typeof obj === "object" && obj !== null) {
        if (
          !Array.isArray(obj) &&
          ("type" in obj || "properties" in obj || "parameters" in obj || "function" in obj)
        ) {
          return "schema";
        }
        if (Array.isArray(obj) && obj.length > 0) {
          const firstItem = obj[0];
          if (
            typeof firstItem === "object" &&
            firstItem !== null &&
            "type" in firstItem &&
            (firstItem.type === "tool_result" ||
              firstItem.type === "tool_use" ||
              (typeof (firstItem as Record<string, unknown>).content === "object" &&
                Array.isArray((firstItem as Record<string, unknown>).content) &&
                ((firstItem as Record<string, unknown>).content as unknown[]).some(
                  (b) =>
                    typeof b === "object" &&
                    b !== null &&
                    ((b as Record<string, unknown>).type === "tool_result" ||
                      (b as Record<string, unknown>).type === "tool_use")
                )))
          ) {
            return "tool_result";
          }
          if (
            "role" in firstItem &&
            Array.isArray((firstItem as Record<string, unknown>).content)
          ) {
            const hasToolContent = (obj as Record<string, unknown>[]).some(
              (msg) =>
                Array.isArray(msg.content) &&
                (msg.content as Record<string, unknown>[]).some(
                  (b) => b.type === "tool_result" || b.type === "tool_use"
                )
            );
            if (hasToolContent) return "tool_result";
          }
        }
        return "json";
      }
      return "json";
    } catch {
      // Not valid JSON, check for code-like patterns
    }
  }
  const codeIndicators = (str.match(/[{}();=<>[\]]/g) || []).length;
  if (codeIndicators / str.length > 0.04) return "code";
  return "text";
}

export function estimateTokens(text: string | object | null | undefined, ratio?: number): number {
  if (!text) return 0;
  const str = typeof text === "string" ? text : JSON.stringify(text);
  const effectiveRatio =
    ratio ?? CHARS_PER_TOKEN[detectContentType(str)] ?? CHARS_PER_TOKEN.default;
  return Math.ceil(str.length / effectiveRatio);
}

export function estimateTokensDetailed(
  text: string | object | null | undefined,
  ratio?: number
): { tokens: number; contentType: string; ratio: number } {
  if (!text) return { tokens: 0, contentType: "text", ratio: CHARS_PER_TOKEN.text };
  const str = typeof text === "string" ? text : JSON.stringify(text);
  const contentType = detectContentType(str);
  const effectiveRatio = ratio ?? CHARS_PER_TOKEN[contentType] ?? CHARS_PER_TOKEN.default;
  return { tokens: Math.ceil(str.length / effectiveRatio), contentType, ratio: effectiveRatio };
}

export function estimateRequestTokens(body: JsonRecord): number {
  if (!body || typeof body !== "object") return 0;

  let total = 0;

  if (Array.isArray(body.messages)) {
    total += estimateTokens(JSON.stringify(body.messages));
  }

  const hasSystemInMessages =
    Array.isArray(body.messages) &&
    (body.messages as JsonRecord[]).some((m) => m.role === "system");
  if (body.system && !hasSystemInMessages) {
    total += estimateTokens(body.system as string | object);
  }

  if (Array.isArray(body.tools)) {
    total += estimateTokens(JSON.stringify(body.tools));
  }

  if (body.input) {
    total += estimateTokens(body.input as string | object);
  }

  return total;
}

export { CHARS_PER_TOKEN };

export function validateContextLimit(
  body: JsonRecord,
  provider: string,
  model: string | null = null,
  combo: Record<string, unknown> | null = null
): { valid: boolean; estimatedTokens: number; limit: number; exceeded: number; rawLimit: number } {
  const estimatedTokens = estimateRequestTokens(body);
  const rawLimit = getEffectiveContextLimit(provider, model, combo);
  const limit = getSafeLimit(rawLimit);
  const exceeded = Math.max(0, estimatedTokens - limit);

  return {
    valid: estimatedTokens <= limit,
    estimatedTokens,
    limit,
    exceeded,
    rawLimit,
  };
}
