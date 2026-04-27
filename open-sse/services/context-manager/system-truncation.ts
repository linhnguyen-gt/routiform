import type { JsonRecord } from "./types.ts";
import { estimateRequestTokens, CHARS_PER_TOKEN, detectContentType } from "./token-estimation.ts";

export function truncateSystemPrompt(
  body: JsonRecord,
  currentTokens: number,
  targetTokens: number
): { body: JsonRecord; tokensRemoved: number } {
  let nextBody = { ...body };
  const tokensBefore = currentTokens;
  const excessTokens = currentTokens - targetTokens;
  const systemVal = nextBody.system;
  let systemStr: string;
  if (typeof systemVal === "string") {
    systemStr = systemVal;
  } else if (Array.isArray(systemVal)) {
    systemStr = JSON.stringify(systemVal);
  } else {
    systemStr = String(systemVal ?? "");
  }
  const sysRatio = CHARS_PER_TOKEN[detectContentType(systemStr)] || CHARS_PER_TOKEN.default;
  const charsToDrop = Math.ceil(excessTokens * sysRatio);

  if (typeof systemVal === "string") {
    const preservedChars = Math.max(200, Math.ceil(systemVal.length * 0.3));
    if (systemVal.length > charsToDrop + preservedChars) {
      const truncationPoint = systemVal.length - charsToDrop;
      nextBody.system =
        systemVal.slice(0, truncationPoint) +
        "\n\n[... system prompt truncated to fit context limit — critical instructions preserved above ...]";
    } else if (systemVal.length > 100) {
      nextBody.system =
        systemVal.slice(0, preservedChars) +
        "\n\n[... system prompt heavily truncated — some instructions may be lost ...]";
    } else {
      nextBody.system = "[system prompt truncated to fit context limit]";
    }
  } else if (Array.isArray(systemVal)) {
    const blocks = [...(systemVal as JsonRecord[])];
    let remaining = charsToDrop;
    for (let i = blocks.length - 1; i >= 0 && remaining > 0; i--) {
      if (blocks[i].type === "text" && typeof blocks[i].text === "string") {
        const preservedChars = Math.max(100, Math.ceil((blocks[i].text as string).length * 0.2));
        if ((blocks[i].text as string).length > remaining + preservedChars) {
          blocks[i] = {
            ...blocks[i],
            text:
              (blocks[i].text as string).slice(0, (blocks[i].text as string).length - remaining) +
              "\n[... truncated]",
          };
          remaining = 0;
        } else if ((blocks[i].text as string).length > remaining) {
          blocks[i] = {
            ...blocks[i],
            text: (blocks[i].text as string).slice(0, preservedChars) + "\n[... truncated]",
          };
          remaining -= (blocks[i].text as string).length - preservedChars;
        } else {
          blocks[i] = { ...blocks[i], text: "[truncated]" };
          remaining -= (blocks[i].text as string).length;
        }
      }
    }
    nextBody.system = blocks;
  }

  const newTokens = estimateRequestTokens(nextBody);
  return { body: nextBody, tokensRemoved: tokensBefore - newTokens };
}
