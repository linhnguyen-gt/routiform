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

function summarizeThinkingBlock(thinkingText: string): string {
  const lines = thinkingText.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return "";

  const keyPatterns = [
    { regex: /\b(?:investigated|analyzing|debugging|examining)\b/i, label: "Analyzed" },
    { regex: /\b(?:decided|chose|going with|will use|picked)\b/i, label: "Decided" },
    { regex: /\b(?:found|discovered|realized|noticed|identified)\b/i, label: "Found" },
    { regex: /\b(?:error|exception|fail|bug|broken|crash)\b/i, label: "Error" },
    { regex: /\b(?:must|should|need to|have to|required)\b/i, label: "Requirement" },
  ];

  const snippets: string[] = [];
  for (const line of lines) {
    for (const pat of keyPatterns) {
      if (pat.regex.test(line)) {
        const short = line.trim().slice(0, 160) + (line.trim().length > 160 ? "…" : "");
        snippets.push(`${pat.label}: ${short}`);
        break;
      }
    }
    if (snippets.length >= 4) break;
  }

  if (snippets.length === 0 && lines.length > 0) {
    snippets.push(lines[0].trim().slice(0, 200));
  }

  return snippets.length > 0
    ? `[Earlier analysis: ${snippets.join(" | ")}]`
    : "[thinking compressed]";
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
      const contentArr = msg.content as JsonRecord[];
      const thinkingBlocks = contentArr.filter((block) => block.type === "thinking");
      const nonThinking = contentArr.filter((block) => block.type !== "thinking");

      if (thinkingBlocks.length === 0) return msg;

      const thinkingSummary = thinkingBlocks
        .map((b) => (typeof b.thinking === "string" ? b.thinking : b.text || ""))
        .join(" ")
        .slice(0, 2000);

      const summary = summarizeThinkingBlock(thinkingSummary);
      if (nonThinking.length > 0) {
        return { ...msg, content: [...nonThinking, { type: "text", text: summary }] };
      }
      return { ...msg, content: [{ type: "text", text: summary }] };
    }

    if (typeof msg.content === "string") {
      const thinkingMatch = msg.content.match(/<thinking>([\s\S]*?)<\/thinking>/g);
      const antThinkingMatch = msg.content.match(/<antThinking>([\s\S]*?)<\/antThinking>/g);
      const allThinking = [...(thinkingMatch || []), ...(antThinkingMatch || [])];

      if (allThinking.length === 0) return msg;

      const thinkingText = allThinking
        .map((t) => t.replace(/<\/?thinking>/g, "").replace(/<\/?antThinking>/g, ""))
        .join(" ")
        .slice(0, 2000);

      const summary = summarizeThinkingBlock(thinkingText);
      const cleaned = msg.content
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
        .replace(/<antThinking>[\s\S]*?<\/antThinking>/g, "")
        .trim();
      return {
        ...msg,
        content: cleaned ? `${cleaned}\n\n${summary}` : summary,
      };
    }

    return msg;
  });
}
