import type { JsonRecord } from "./types.ts";
import {
  CONSTRAINT_PATTERNS,
  DECISION_PATTERNS,
  ERROR_PATTERNS_ANCHOR,
  extractTextContent,
} from "./semantic-extraction.ts";
import { addCompressionSummary } from "./semantic-extraction.ts";
import { normalizePurifiedMessages } from "./conversation-normalizer.ts";

function scoreMessageImportance(msg: JsonRecord, index: number, total: number): number {
  let score = 0;
  const content = extractTextContent(msg);
  const role = typeof msg.role === "string" ? msg.role : "";

  score += (index / total) * 40;

  if (role === "system" || role === "developer") {
    score += 100;
  } else if (role === "user") {
    if (index === total - 1 || (index === total - 2 && total - 1 >= 0)) {
      score += 80;
    } else {
      score += 30;
    }
    if (content && CONSTRAINT_PATTERNS.some((p) => p.test(content))) {
      score += 25;
    }
  } else if (role === "assistant") {
    score += 20;
    if (content && DECISION_PATTERNS.some((p) => p.test(content))) {
      score += 15;
    }
  } else if (role === "tool") {
    if (content && ERROR_PATTERNS_ANCHOR.some((p) => p.test(content))) {
      score += 35;
    } else {
      score += 5;
    }
  }

  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    score += 20;
  }
  if (Array.isArray(msg.content)) {
    const hasToolUse = (msg.content as JsonRecord[]).some(
      (b) => b.type === "tool_use" || b.type === "server_tool_use"
    );
    if (hasToolUse) score += 20;
  }

  return score;
}

function findLastUserIndex(messages: JsonRecord[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return i;
  }
  return -1;
}

function selectImportantMessages(messages: JsonRecord[], count: number): JsonRecord[] {
  if (count >= messages.length) return [...messages];
  if (count <= 0) return [];

  const total = messages.length;
  const scored = messages.map((msg, i) => ({
    msg,
    index: i,
    score: scoreMessageImportance(msg, i, total),
  }));

  const lastUserIdx = findLastUserIndex(messages);
  const mustInclude = new Set<number>();
  if (lastUserIdx >= 0) mustInclude.add(lastUserIdx);

  const tailSize = Math.min(3, count);
  for (let i = total - tailSize; i < total; i++) {
    if (i >= 0) mustInclude.add(i);
  }

  const remaining = count - mustInclude.size;
  const candidates = scored
    .filter((s) => !mustInclude.has(s.index))
    .sort((a, b) => b.score - a.score)
    .slice(0, remaining);

  const selected = new Set<number>(Array.from(mustInclude).concat(candidates.map((c) => c.index)));
  const result = messages.filter((_, i) => selected.has(i));

  const firstUserIdx = result.findIndex((m) => m.role === "user");
  if (firstUserIdx > 0) {
    return result.slice(firstUserIdx);
  }

  return result;
}

export function purifyHistory(
  messages: JsonRecord[],
  fitsWithinTarget: (msgs: JsonRecord[]) => boolean
): { messages: JsonRecord[]; droppedCount: number } {
  const system = messages.filter((m) => m.role === "system" || m.role === "developer");
  const nonSystem = messages.filter((m) => m.role !== "system" && m.role !== "developer");

  if (nonSystem.length === 0) {
    return { messages: [...system], droppedCount: 0 };
  }

  const buildCandidate = (
    keepCount: number,
    includeSummary: boolean,
    droppedSlice: JsonRecord[]
  ): JsonRecord[] => {
    let keptMessages: JsonRecord[] = [];
    if (keepCount > 0) {
      keptMessages = selectImportantMessages(nonSystem, keepCount);
    }
    const candidate =
      includeSummary && keepCount < nonSystem.length
        ? addCompressionSummary(system, keptMessages, droppedSlice)
        : [...system, ...keptMessages];
    return normalizePurifiedMessages(candidate);
  };

  let keep = nonSystem.length;
  while (keep >= 0) {
    const droppedSlice = keep < nonSystem.length ? nonSystem.slice(0, nonSystem.length - keep) : [];
    const withSummary = buildCandidate(keep, true, droppedSlice);
    if (fitsWithinTarget(withSummary)) {
      return { messages: withSummary, droppedCount: nonSystem.length - keep };
    }

    const withoutSummary = buildCandidate(keep, false, []);
    if (fitsWithinTarget(withoutSummary)) {
      return { messages: withoutSummary, droppedCount: nonSystem.length - keep };
    }

    if (keep === 0) break;
    const nextKeep = Math.max(0, Math.floor(keep * 0.9));
    keep = nextKeep < keep ? nextKeep : keep - 1;
  }

  return { messages: buildCandidate(0, false, []), droppedCount: nonSystem.length };
}
