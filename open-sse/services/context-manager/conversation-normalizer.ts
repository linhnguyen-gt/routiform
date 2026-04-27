import type { JsonRecord } from "./types.ts";

export function normalizePurifiedMessages(messages: JsonRecord[]): JsonRecord[] {
  const systemPrefix = messages.filter((m) => m.role === "system" || m.role === "developer");
  const conversation = messages.filter((m) => m.role !== "system" && m.role !== "developer");

  let start = 0;
  while (start < conversation.length && conversation[start].role !== "user") {
    start += 1;
  }
  const anchoredConversation = conversation.slice(start);

  const seenToolUseIds = new Set<string>();
  const normalizedConversation: JsonRecord[] = [];

  for (const msg of anchoredConversation) {
    if (!msg || typeof msg !== "object") continue;
    const role = typeof msg.role === "string" ? msg.role : "";

    if (role === "assistant") {
      if (Array.isArray(msg.tool_calls)) {
        for (const toolCall of msg.tool_calls as Array<{ id?: string }>) {
          if (typeof toolCall?.id === "string" && toolCall.id.trim()) {
            seenToolUseIds.add(toolCall.id.trim());
          }
        }
      }

      if (Array.isArray(msg.content)) {
        for (const block of msg.content as JsonRecord[]) {
          if (
            block?.type === "tool_use" &&
            typeof block.id === "string" &&
            String(block.id).trim()
          ) {
            seenToolUseIds.add(String(block.id).trim());
          }
        }
      }

      normalizedConversation.push(msg);
      continue;
    }

    if (role === "tool") {
      const toolCallId = typeof msg.tool_call_id === "string" ? msg.tool_call_id.trim() : "";
      if (toolCallId && seenToolUseIds.has(toolCallId)) {
        normalizedConversation.push(msg);
      }
      continue;
    }

    if (role === "user" && Array.isArray(msg.content)) {
      const filteredContent = (msg.content as JsonRecord[]).filter((block) => {
        if (block?.type !== "tool_result") return true;
        const toolUseId =
          typeof block.tool_use_id === "string" ? String(block.tool_use_id).trim() : "";
        return !toolUseId || seenToolUseIds.has(toolUseId);
      });

      if (filteredContent.length === 0) continue;
      normalizedConversation.push({ ...msg, content: filteredContent });
      continue;
    }

    normalizedConversation.push(msg);
  }

  return [...systemPrefix, ...normalizedConversation];
}
