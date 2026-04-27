import type { JsonRecord } from "./types.ts";
import { compactContentString } from "./content-compaction.ts";

export function trimToolMessages(
  messages: JsonRecord[],
  maxChars: number
): { messages: JsonRecord[]; truncatedCount: number } {
  let truncatedCount = 0;
  const result = messages.map((msg) => {
    if (msg.role === "tool") {
      if (typeof msg.content === "string" && msg.content.length > maxChars) {
        truncatedCount++;
        return { ...msg, content: compactContentString(msg.content, maxChars) };
      }
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: (msg.content as JsonRecord[]).map((block) => {
            if (
              block.type === "text" &&
              typeof block.text === "string" &&
              block.text.length > maxChars
            ) {
              truncatedCount++;
              return { ...block, text: compactContentString(block.text, maxChars) };
            }
            return block;
          }),
        };
      }
    }
    if (msg.role === "user" && Array.isArray(msg.content)) {
      return {
        ...msg,
        content: (msg.content as JsonRecord[]).map((block) => {
          if (block.type === "tool_result") {
            if (typeof block.content === "string" && block.content.length > maxChars) {
              truncatedCount++;
              return { ...block, content: compactContentString(block.content, maxChars) };
            } else if (Array.isArray(block.content)) {
              let subTruncated = 0;
              const newContent = (block.content as JsonRecord[]).map((subBlock) => {
                if (
                  subBlock.type === "text" &&
                  typeof subBlock.text === "string" &&
                  subBlock.text.length > maxChars
                ) {
                  subTruncated++;
                  return { ...subBlock, text: compactContentString(subBlock.text, maxChars) };
                }
                return subBlock;
              });
              truncatedCount += subTruncated;
              return { ...block, content: newContent };
            }
          }
          return block;
        }),
      };
    }
    return msg;
  });
  return { messages: result, truncatedCount };
}

export function compressThinking(messages: JsonRecord[]): JsonRecord[] {
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantIdx = i;
      break;
    }
  }

  return messages.map((msg, i) => {
    if (msg.role !== "assistant") return msg;
    if (i === lastAssistantIdx) return msg;

    if (Array.isArray(msg.content)) {
      const filtered = (msg.content as JsonRecord[]).filter((block) => block.type !== "thinking");
      if (filtered.length === 0) {
        return { ...msg, content: [{ type: "text", text: "[thinking compressed]" }] };
      }
      return { ...msg, content: filtered };
    }

    if (typeof msg.content === "string") {
      const cleaned = msg.content
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
        .replace(/<antThinking>[\s\S]*?<\/antThinking>/g, "")
        .trim();
      return { ...msg, content: cleaned || "[thinking compressed]" };
    }

    return msg;
  });
}
