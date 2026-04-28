const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const NBSP_REGEX = /(?:&nbsp;|&#160;|\u00A0)/gi;
const BR_TAG_REGEX = /<br\s*\/?>/gi;
const EMPTY_P_REGEX = /<p>\s*(?:<br\s*\/?>|&nbsp;|&#160;|\u00A0|\s)*<\/p>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;

function toCandidateString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractVisibleText(value: unknown): string {
  const raw = toCandidateString(value);
  if (!raw) return "";

  const normalized = raw
    .replace(ZERO_WIDTH_REGEX, "")
    .replace(EMPTY_P_REGEX, "\n")
    .replace(BR_TAG_REGEX, "\n")
    .replace(NBSP_REGEX, " ")
    .replace(HTML_TAG_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

export function hasRenderableAssistantText(value: unknown): boolean {
  return extractVisibleText(value).length > 0;
}

export function normalizePlaceholderOnlyAssistantText(value: unknown): string {
  const raw = toCandidateString(value);
  if (!raw) return "";
  return hasRenderableAssistantText(raw) ? raw : "";
}
