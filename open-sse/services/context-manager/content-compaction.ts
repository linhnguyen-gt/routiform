const ERROR_SIGNALS = [
  /\berror\b/i,
  /\bexception\b/i,
  /\bfail(ed|ure)?\b/i,
  /\btraceback\b/i,
  /\bstack\s*trace\b/i,
  /\bfatal\b/i,
  /\bwarning\b/i,
  /\bwarn\b/i,
  /\bpanic\b/i,
  /\bnot\s+found\b/i,
  /\bdenied\b/i,
  /\bforbidden\b/i,
  /\bunauthorized\b/i,
  /\btimeout\b/i,
  /\babort(ed)?\b/i,
];

function extractSignalLines(text: string, maxLines: number = 50): string[] {
  const lines = text.split("\n");
  const signalLines: string[] = [];
  for (const line of lines) {
    if (signalLines.length >= maxLines) break;
    if (ERROR_SIGNALS.some((p) => p.test(line))) {
      signalLines.push(line);
    }
  }
  return signalLines;
}

function compactJsonOutput(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  try {
    const obj = JSON.parse(text);
    const compacted = JSON.stringify(obj, (key, value) => {
      if (typeof value === "string" && value.length > 200) {
        return value.slice(0, 200) + "... [truncated]";
      }
      return value;
    });
    if (compacted.length <= maxChars) return compacted;
  } catch {
    // Not valid JSON, fall through to text compaction
  }
  return compactTextWithSignals(text, maxChars);
}

function compactTextWithSignals(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const signals = extractSignalLines(text, 40);
  if (signals.length > 3) {
    const signalBlock = signals.join("\n");
    const remainingBudget = maxChars - signalBlock.length - 60;
    if (remainingBudget > 200) {
      const head = text.slice(0, Math.ceil(remainingBudget * 0.6));
      const tail = text.slice(text.length - Math.floor(remainingBudget * 0.4));
      return (
        head +
        "\n\n... [truncated] Key signal lines:\n" +
        signalBlock +
        "\n\n... [truncated] ...\n" +
        tail
      );
    }
  }

  const signalHead = extractSignalLines(text.slice(0, Math.ceil(maxChars * 0.3)), 10);
  const headBudget = Math.ceil(maxChars * 0.55);
  const tailBudget = maxChars - headBudget - 30;
  const head = text.slice(0, headBudget);
  const tail = text.slice(text.length - tailBudget);
  let result = head + "\n... [truncated] ...\n" + tail;
  if (signalHead.length > 0 && !result.includes(signalHead[0])) {
    const signalPrefix = signalHead.slice(0, 5).join("\n");
    result = signalPrefix + "\n... [signal lines] ...\n" + result;
  }
  return result;
}

export function compactContentString(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  const trimmed = content.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return compactJsonOutput(content, maxChars);
  }
  return compactTextWithSignals(content, maxChars);
}
