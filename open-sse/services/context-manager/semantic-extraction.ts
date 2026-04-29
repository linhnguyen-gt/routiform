import type { JsonRecord } from "./types.ts";

const CONSTRAINT_PATTERNS = [
  /\b(must|shall|always|never|do\s+not|don'?t|required?|mandatory|essential|critical|important|vital|strictly)\b/i,
  /\b(constraint|requirement|prerequisite|condition|limitation|restriction|boundary|deadline)\b/i,
];

const DECISION_PATTERNS = [
  /\b(decided|decision|chose|chosen|going\s+to|will\s+use|we'?ll|plan\s+is|strategy|approach)\b/i,
];

const ERROR_PATTERNS_ANCHOR = [
  /\berror\b/i,
  /\bexception\b/i,
  /\bfail(ed|ure)?\b/i,
  /\btraceback\b/i,
  /\bblocked\b/i,
];

const QUESTION_PATTERN = /\?/;

export function extractTextContent(msg: JsonRecord): string | null {
  if (!msg || typeof msg !== "object") return null;
  const content = msg.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as JsonRecord[])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");
  }
  return null;
}

function extractAnchors(droppedMessages: JsonRecord[]): {
  goal: string | null;
  constraints: string[];
  decisions: string[];
  errors: string[];
  openIssues: string[];
} {
  let goal: string | null = null;
  const constraints: string[] = [];
  const decisions: string[] = [];
  const errors: string[] = [];
  const openIssues: string[] = [];
  const MAX_PER_CATEGORY = 6;
  const MAX_LINE_LENGTH = 200;

  const truncate = (s: string): string =>
    s.length > MAX_LINE_LENGTH ? s.slice(0, MAX_LINE_LENGTH) + "..." : s;

  for (const msg of droppedMessages) {
    const content = extractTextContent(msg);
    if (!content) continue;

    if (!goal && msg.role === "user") {
      goal = truncate(content.split("\n")[0]);
    }

    if ((msg.role === "user" || msg.role === "system") && constraints.length < MAX_PER_CATEGORY) {
      for (const line of content.split("\n")) {
        if (CONSTRAINT_PATTERNS.some((p) => p.test(line))) {
          constraints.push(truncate(line.trim()));
          if (constraints.length >= MAX_PER_CATEGORY) break;
        }
      }
    }

    if (msg.role === "assistant" && decisions.length < MAX_PER_CATEGORY) {
      for (const line of content.split("\n")) {
        if (DECISION_PATTERNS.some((p) => p.test(line))) {
          decisions.push(truncate(line.trim()));
          if (decisions.length >= MAX_PER_CATEGORY) break;
        }
      }
    }

    if ((msg.role === "tool" || msg.role === "assistant") && errors.length < MAX_PER_CATEGORY) {
      for (const line of content.split("\n")) {
        if (ERROR_PATTERNS_ANCHOR.some((p) => p.test(line))) {
          errors.push(truncate(line.trim()));
          if (errors.length >= MAX_PER_CATEGORY) break;
        }
      }
    }

    if (msg.role === "user" && openIssues.length < MAX_PER_CATEGORY) {
      for (const line of content.split("\n")) {
        if (QUESTION_PATTERN.test(line) && line.trim().length > 10) {
          openIssues.push(truncate(line.trim()));
          if (openIssues.length >= MAX_PER_CATEGORY) break;
        }
      }
    }
  }

  return { goal, constraints, decisions, errors, openIssues };
}

function buildStructuredSummary(droppedMessages: JsonRecord[], droppedCount: number): string {
  const anchors = extractAnchors(droppedMessages);
  const parts: string[] = [
    `[Context compressed: ${droppedCount} earlier messages removed to fit context window]`,
  ];

  if (anchors.goal) parts.push(`Goal: ${anchors.goal}`);
  if (anchors.constraints.length > 0) parts.push(`Constraints: ${anchors.constraints.join("; ")}`);
  if (anchors.decisions.length > 0) parts.push(`Decisions: ${anchors.decisions.join("; ")}`);
  if (anchors.errors.length > 0) parts.push(`Prior errors: ${anchors.errors.join("; ")}`);
  if (anchors.openIssues.length > 0) parts.push(`Open issues: ${anchors.openIssues.join("; ")}`);

  return parts.join("\n");
}

export function addCompressionSummary(
  system: JsonRecord[],
  keptMessages: JsonRecord[],
  droppedMessages: JsonRecord[]
): JsonRecord[] {
  const summary = buildStructuredSummary(droppedMessages, droppedMessages.length);
  const candidate = [...system, ...keptMessages];
  const firstConversationIdx = candidate.findIndex(
    (msg) => msg.role !== "system" && msg.role !== "developer"
  );

  if (firstConversationIdx === -1) {
    return [...system, { role: "user", content: summary }];
  }

  const firstMessage = candidate[firstConversationIdx];
  if (firstMessage.role === "user") {
    if (typeof firstMessage.content === "string") {
      candidate[firstConversationIdx] = {
        ...firstMessage,
        content: `${summary}\n\n${firstMessage.content}`,
      };
      return candidate;
    }

    if (Array.isArray(firstMessage.content)) {
      candidate[firstConversationIdx] = {
        ...firstMessage,
        content: [{ type: "text", text: summary }, ...(firstMessage.content as JsonRecord[])],
      };
      return candidate;
    }
  }

  candidate.splice(firstConversationIdx, 0, { role: "user", content: summary });
  return candidate;
}

export { CONSTRAINT_PATTERNS, DECISION_PATTERNS, ERROR_PATTERNS_ANCHOR, QUESTION_PATTERN };
