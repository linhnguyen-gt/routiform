import type { JsonRecord, CompressContextStats } from "./types.ts";
import { estimateRequestTokens } from "./token-estimation.ts";
import { getTokenLimit } from "./token-limits.ts";
import { compactToolDefinitions } from "./tool-compaction.ts";
import { trimToolMessages, compressThinking } from "./message-trimming.ts";
import { purifyHistory } from "./message-purification.ts";
import { truncateSystemPrompt } from "./system-truncation.ts";
import { CONTEXT_CONFIG } from "../../../src/shared/constants/context";

export function compressContext(
  body: JsonRecord,
  options: { provider?: string; model?: string; maxTokens?: number; reserveTokens?: number } = {}
): { body: JsonRecord; compressed: boolean; stats: CompressContextStats } {
  if (!body || !body.messages || !Array.isArray(body.messages)) {
    const t = estimateRequestTokens(body);
    return { body, compressed: false, stats: { original: t, final: t, layers: [] } };
  }

  const provider = options.provider || "default";
  const configuredMaxTokens = Number(options.maxTokens);
  const maxTokens =
    Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0
      ? Math.floor(configuredMaxTokens)
      : getTokenLimit(provider, (body.model as string | null | undefined) || options.model);
  const defaultReserveTokens = Math.min(
    CONTEXT_CONFIG.reserveTokens,
    Math.max(256, Math.floor(maxTokens * 0.15))
  );
  const configuredReserveTokens = Number(options.reserveTokens);
  const reserveTokens =
    Number.isFinite(configuredReserveTokens) && configuredReserveTokens >= 0
      ? Math.min(Math.floor(configuredReserveTokens), Math.max(0, maxTokens - 1))
      : defaultReserveTokens;
  const targetTokens = Math.max(0, maxTokens - reserveTokens);

  let messages = [...body.messages];
  let tools = Array.isArray(body.tools) ? [...body.tools] : body.tools;
  const buildWorkingBody = (): JsonRecord => ({ ...body, messages, tools }) as JsonRecord;
  let currentTokens = estimateRequestTokens(buildWorkingBody());
  const stats: Omit<CompressContextStats, "final"> & { final?: number } = {
    original: currentTokens,
    layers: [],
    droppedMessageCount: 0,
    truncatedToolCount: 0,
    compressedThinkingCount: 0,
    summaryInserted: false,
    systemTruncated: false,
  };

  if (currentTokens <= targetTokens) {
    return {
      body,
      compressed: false,
      stats: { original: currentTokens, final: currentTokens, layers: [] },
    };
  }

  // Layer 0: Compact tool definitions
  if (Array.isArray(tools) && tools.length > 0) {
    const tokensBefore = currentTokens;
    tools = compactToolDefinitions(tools, messages, 96, body);
    currentTokens = estimateRequestTokens(buildWorkingBody());
    stats.layers.push({
      name: "compact_tools",
      tokens: currentTokens,
      tokensRemoved: tokensBefore - currentTokens,
    });
    if (currentTokens <= targetTokens) {
      return {
        body: buildWorkingBody(),
        compressed: true,
        stats: { ...stats, final: currentTokens },
      };
    }
  }

  // Layer 1: Trim tool messages
  {
    const tokensBefore = currentTokens;
    const trimResult = trimToolMessages(messages, 2000);
    messages = trimResult.messages;
    stats.truncatedToolCount = trimResult.truncatedCount;
    currentTokens = estimateRequestTokens(buildWorkingBody());
    stats.layers.push({
      name: "trim_tools",
      tokens: currentTokens,
      tokensRemoved: tokensBefore - currentTokens,
      details: { truncatedCount: trimResult.truncatedCount },
    });
    if (currentTokens <= targetTokens) {
      return {
        body: buildWorkingBody(),
        compressed: true,
        stats: { ...stats, final: currentTokens },
      };
    }
  }

  // Layer 2: Compress thinking blocks
  {
    const tokensBefore = currentTokens;
    let thinkingCount = 0;
    const newMessages = compressThinking(messages);
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "assistant") {
        const wasThinking = Array.isArray(messages[i].content)
          ? (messages[i].content as JsonRecord[]).filter((b) => b.type === "thinking").length
          : typeof messages[i].content === "string"
            ? ((messages[i].content as string).match(/<thinking>[\s\S]*?<\/thinking>/g) || [])
                .length +
              ((messages[i].content as string).match(/<antThinking>[\s\S]*?<\/antThinking>/g) || [])
                .length
            : 0;
        const isStillThinking = Array.isArray(newMessages[i].content)
          ? (newMessages[i].content as JsonRecord[]).filter((b) => b.type === "thinking").length
          : 0;
        thinkingCount += Math.max(0, wasThinking - isStillThinking);
      }
    }
    messages = newMessages;
    stats.compressedThinkingCount = thinkingCount;
    currentTokens = estimateRequestTokens(buildWorkingBody());
    stats.layers.push({
      name: "compress_thinking",
      tokens: currentTokens,
      tokensRemoved: tokensBefore - currentTokens,
      details: { thinkingBlocksRemoved: thinkingCount },
    });
    if (currentTokens <= targetTokens) {
      return {
        body: buildWorkingBody(),
        compressed: true,
        stats: { ...stats, final: currentTokens },
      };
    }
  }

  // Layer 3: Importance-aware purification
  {
    const tokensBefore = currentTokens;
    const purifyResult = purifyHistory(
      messages,
      (candidateMessages) =>
        estimateRequestTokens({ ...body, messages: candidateMessages, tools }) <= targetTokens
    );
    messages = purifyResult.messages;
    stats.droppedMessageCount = purifyResult.droppedCount;
    stats.summaryInserted = purifyResult.droppedCount > 0;
    currentTokens = estimateRequestTokens(buildWorkingBody());
    stats.layers.push({
      name: "purify_history",
      tokens: currentTokens,
      tokensRemoved: tokensBefore - currentTokens,
      details: { droppedMessages: purifyResult.droppedCount },
    });
    if (currentTokens <= targetTokens) {
      return {
        body: buildWorkingBody(),
        compressed: true,
        stats: { ...stats, final: currentTokens },
      };
    }
  }

  // Layer 3.5: Aggressive trim re-attempt
  {
    const tokensBefore = currentTokens;
    const aggressiveTrimResult = trimToolMessages(messages, 500);
    if (aggressiveTrimResult.truncatedCount > 0) {
      messages = aggressiveTrimResult.messages;
      stats.truncatedToolCount += aggressiveTrimResult.truncatedCount;
      currentTokens = estimateRequestTokens(buildWorkingBody());
      if (currentTokens < tokensBefore) {
        stats.layers.push({
          name: "aggressive_trim_tools",
          tokens: currentTokens,
          tokensRemoved: tokensBefore - currentTokens,
          details: { truncatedCount: aggressiveTrimResult.truncatedCount },
        });
        if (currentTokens <= targetTokens) {
          return {
            body: buildWorkingBody(),
            compressed: true,
            stats: { ...stats, final: currentTokens },
          };
        }
      }
    }
  }

  // Layer 4: System prompt truncation (last resort)
  const finalBody = buildWorkingBody();
  if (finalBody.system) {
    const truncated = truncateSystemPrompt(finalBody, currentTokens, targetTokens);
    stats.systemTruncated = true;
    stats.layers.push({
      name: "truncate_system",
      tokens: estimateRequestTokens(truncated.body),
      tokensRemoved: truncated.tokensRemoved,
    });
    return {
      body: truncated.body,
      compressed: true,
      stats: { ...stats, final: estimateRequestTokens(truncated.body) },
    };
  }

  return { body: finalBody, compressed: true, stats: { ...stats, final: currentTokens } };
}
