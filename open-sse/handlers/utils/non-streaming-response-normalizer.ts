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
      const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : null;
      if (toolCalls && toolCalls.length > 0 && choice.finish_reason !== "tool_calls") {
        choice.finish_reason = "tool_calls";
      }
    }
  }

  if (sourceFormat === FORMATS.OPENAI || sourceFormat === FORMATS.OPENAI_RESPONSES) {
    translatedResponse = sanitizeOpenAIResponse(translatedResponse) as JsonRecord;
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
