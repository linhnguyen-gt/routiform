import type { JsonRecord } from "./types.ts";
import {
  CONSTRAINT_PATTERNS,
  DECISION_PATTERNS,
  ERROR_PATTERNS_ANCHOR,
  extractTextContent,
  QUESTION_PATTERN,
} from "./semantic-extraction.ts";
import { addCompressionSummary } from "./semantic-extraction.ts";
import { normalizePurifiedMessages } from "./conversation-normalizer.ts";

function groupMessagesIntoTurns(messages: JsonRecord[]): JsonRecord[][] {
  const turns: JsonRecord[][] = [];
  let currentTurn: JsonRecord[] = [];

  for (const msg of messages) {
    if (msg.role === "user" && currentTurn.length > 0) {
      turns.push(currentTurn);
      currentTurn = [];
    }
    currentTurn.push(msg);
  }
  if (currentTurn.length > 0) turns.push(currentTurn);

  return turns;
}

function selectTurns(turns: JsonRecord[][], count: number, total: number): JsonRecord[][] {
  if (count >= turns.length) return [...turns];
  if (count <= 0) return [];

  const scored = turns.map((turn, i) => {
    let score = 0;
    for (const msg of turn) {
      const content = extractTextContent(msg);
      const role = typeof msg.role === "string" ? msg.role : "";
      if (role === "user" && content) {
        score += 10;
        if (CONSTRAINT_PATTERNS.some((p) => p.test(content))) score += 15;
        if (QUESTION_PATTERN.test(content)) score += 5;
      }
      if (role === "assistant" && content) {
        score += 5;
        if (DECISION_PATTERNS.some((p) => p.test(content))) score += 10;
      }
      if (role === "tool" && content) {
        score += 5;
        if (content.length > 2000) score += 10;
        if (ERROR_PATTERNS_ANCHOR.some((p) => p.test(content))) score += 20;
      }
      score += content ? Math.min(5, content.length / 500) : 0;
    }
    score += (i / total) * 20;
    return { turn, index: i, score };
  });

  // Always keep last 2 turns
  const mustKeep = new Set<number>();
  for (let i = Math.max(0, turns.length - 2); i < turns.length; i++) mustKeep.add(i);

  // Always keep first turn (has system prompt / initial context)
  mustKeep.add(0);

  const remaining = count - mustKeep.size;
  const candidates = scored
    .filter((s) => !mustKeep.has(s.index))
    .sort((a, b) => b.score - a.score)
    .slice(0, remaining);

  const selected = new Set([...mustKeep, ...candidates.map((c) => c.index)]);
  return turns.filter((_, i) => selected.has(i));
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

  const turns = groupMessagesIntoTurns(nonSystem);

  const buildCandidate = (
    keptTurns: JsonRecord[][],
    includeSummary: boolean,
    droppedTurns: JsonRecord[][]
  ): JsonRecord[] => {
    const keptMessages = keptTurns.flat();
    const droppedMessages = droppedTurns.flat();
    const candidate =
      includeSummary && droppedMessages.length > 0
        ? addCompressionSummary(system, keptMessages, droppedMessages)
        : [...system, ...keptMessages];
    return normalizePurifiedMessages(candidate);
  };

  let keep = turns.length;
  while (keep >= 0) {
    const selectedTurns = selectTurns(turns, keep, turns.length);
    const droppedTurns = turns.filter((_, i) => !selectedTurns.some((t) => t === turns[i]));
    const droppedMsgs = droppedTurns.flat();

    const withSummary = buildCandidate(selectedTurns, true, droppedTurns);
    if (fitsWithinTarget(withSummary)) {
      return { messages: withSummary, droppedCount: droppedMsgs.length };
    }

    const withoutSummary = buildCandidate(selectedTurns, false, []);
    if (fitsWithinTarget(withoutSummary)) {
      return { messages: withoutSummary, droppedCount: droppedMsgs.length };
    }

    if (keep === 0) break;
    keep = Math.max(0, Math.floor(keep * 0.9));
  }

  return { messages: buildCandidate([], false, []), droppedCount: nonSystem.length };
}
