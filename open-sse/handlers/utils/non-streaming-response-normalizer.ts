import { FORMATS } from "../../translator/formats.ts";
import { needsTranslation } from "../../translator/index.ts";
import { stripMarkdownCodeFence } from "../../utils/aiSdkCompat.ts";
import {
  addBufferToUsage,
  estimateUsage,
  filterUsageForFormat,
} from "../../utils/usageTracking.ts";
import { sanitizeOpenAIResponse } from "../responseSanitizer.ts";
import {
  applyForcedToolChoiceFallback,
  translateNonStreamingResponse,
} from "../responseTranslator.ts";
import type {
  JsonRecord,
  NormalizeNonStreamingTranslatedResponseOptions,
} from "../types/chat-core.ts";

function collapseExactDuplicateMessage(text: unknown): string {
  let value = typeof text === "string" ? text : "";
  for (let pass = 0; pass < 3; pass += 1) {
    const len = value.length;
    if (len < 4) break;

    let collapsed = false;
    const mid = Math.floor(len / 2);
    for (let offset = -3; offset <= 3; offset += 1) {
      const splitAt = mid + offset;
      if (splitAt <= 0 || splitAt >= len) continue;
      const first = value.slice(0, splitAt);
      const secondRaw = value.slice(splitAt);
      const second = secondRaw.replace(/^\s+/, "");

      if (first !== second) continue;
      if (!/[\s.!?;:,)\]]$/.test(first)) continue;
      value = first;
      collapsed = true;
      break;
    }

    if (!collapsed) break;
  }
  return value;
}

const ACTION_INTENT_PATTERNS = [
  /\b(i\s*(?:will|am going to)\s+(?:do|run|execute|start|continue|fix|implement))\b/i,
  /\b(let me\s+(?:do|run|execute|start|continue|fix|implement))\b/i,
  /\b(doing now|starting now|on it now)\b/i,
  /\b(m[iì]nh\s+s[eẽ]\s+(?:l[àa]m|ch[ạa]y|tri[ểe]n\s*khai|s[ửu]a))\b/i,
  /\b(\bđang\s+l[àa]m\b|lam\s+ngay|l[àa]m\s+ngay)\b/i,
];

function looksLikeExecutionClaim(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const normalized = text.trim();
  if (!normalized) return false;
  return ACTION_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasToolsInRequest(requestBody: unknown): boolean {
  if (!requestBody || typeof requestBody !== "object") return false;
  const tools = (requestBody as JsonRecord).tools;
  return Array.isArray(tools) && tools.length > 0;
}

function hasOpenAIToolCalls(response: JsonRecord): boolean {
  const choices = Array.isArray(response.choices) ? (response.choices as JsonRecord[]) : [];
  for (const choice of choices) {
    const message =
      choice && typeof choice.message === "object" && !Array.isArray(choice.message)
        ? (choice.message as JsonRecord)
        : null;
    if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) return true;
  }
  return false;
}

function hasClaudeToolUseBlocks(response: JsonRecord): boolean {
  const content = Array.isArray(response.content) ? (response.content as JsonRecord[]) : [];
  return content.some((block) => block && block.type === "tool_use");
}

function markNoExecutionClaim(response: JsonRecord): JsonRecord {
  const warning = "\n[No tool calls were emitted by the model, so no tool was executed.]";

  if (Array.isArray(response.choices)) {
    for (const choice of response.choices as JsonRecord[]) {
      const message =
        choice && typeof choice.message === "object" && !Array.isArray(choice.message)
          ? (choice.message as JsonRecord)
          : null;
      if (!message || typeof message.content !== "string") continue;
      if (!looksLikeExecutionClaim(message.content)) continue;
      if (!message.content.includes(warning)) {
        message.content = `${message.content}${warning}`;
      }
      return response;
    }
  }

  if (Array.isArray(response.content)) {
    const content = response.content as JsonRecord[];
    for (const block of content) {
      if (!block || block.type !== "text" || typeof block.text !== "string") continue;
      if (!looksLikeExecutionClaim(block.text)) continue;
      if (!block.text.includes(warning)) {
        block.text = `${block.text}${warning}`;
      }
      return response;
    }
  }

  return response;
}

export function normalizeNonStreamingTranslatedResponse({
  requestBody,
  responseBody,
  sourceFormat,
  targetFormat,
  stream,
  toolNameMap,
}: NormalizeNonStreamingTranslatedResponseOptions): JsonRecord {
  let translatedResponse = needsTranslation(targetFormat, sourceFormat)
    ? (translateNonStreamingResponse(
        responseBody,
        targetFormat,
        sourceFormat,
        toolNameMap as Map<string, string> | null
      ) as JsonRecord)
    : (responseBody as JsonRecord) || {};

  translatedResponse = applyForcedToolChoiceFallback(requestBody, translatedResponse) as JsonRecord;

  if (sourceFormat === "claude" && !stream) {
    if (typeof translatedResponse?.choices?.[0]?.message?.content === "string") {
      translatedResponse.choices[0].message.content = stripMarkdownCodeFence(
        translatedResponse.choices[0].message.content
      ) as string;
    }
  }

  if (Array.isArray(translatedResponse?.choices)) {
    for (const choice of translatedResponse.choices as JsonRecord[]) {
      const message =
        choice.message && typeof choice.message === "object" && !Array.isArray(choice.message)
          ? (choice.message as JsonRecord)
          : null;

      if (message && typeof message.content === "string") {
        message.content = collapseExactDuplicateMessage(message.content);
      }

      const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : null;
      if (toolCalls && toolCalls.length > 0 && choice.finish_reason !== "tool_calls") {
        choice.finish_reason = "tool_calls";
      }
    }
  }

  if (Array.isArray(translatedResponse?.content)) {
    for (const block of translatedResponse.content as JsonRecord[]) {
      if (block && typeof block === "object" && block.type === "text") {
        block.text = collapseExactDuplicateMessage(block.text);
      }
    }
  }

  if (sourceFormat === FORMATS.OPENAI || sourceFormat === FORMATS.OPENAI_RESPONSES) {
    translatedResponse = sanitizeOpenAIResponse(translatedResponse) as JsonRecord;
  }

  if (hasToolsInRequest(requestBody)) {
    const noOpenAIToolCalls = !hasOpenAIToolCalls(translatedResponse);
    const noClaudeToolUse = !hasClaudeToolUseBlocks(translatedResponse);
    if (noOpenAIToolCalls && noClaudeToolUse) {
      translatedResponse = markNoExecutionClaim(translatedResponse);
    }
  }

  if (translatedResponse?.usage) {
    const buffered = addBufferToUsage(translatedResponse.usage);
    translatedResponse.usage = filterUsageForFormat(buffered, sourceFormat);
  } else {
    const contentLength = JSON.stringify(
      translatedResponse?.choices?.[0]?.message?.content || ""
    ).length;
    if (contentLength > 0) {
      const estimated = estimateUsage(requestBody, contentLength, sourceFormat);
      translatedResponse.usage = filterUsageForFormat(estimated, sourceFormat);
    }
  }

  return translatedResponse;
}
