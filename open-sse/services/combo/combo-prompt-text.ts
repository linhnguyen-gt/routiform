function toTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") return p.text;
      return "";
    })
    .join("\n");
}

export function extractPromptForIntent(body: Record<string, unknown> | null | undefined): string {
  if (!body || typeof body !== "object") return "";

  const fromMessages = Array.isArray(body.messages)
    ? [...body.messages]
        .reverse()
        .find((m) => m && typeof m === "object" && (m as { role?: string }).role === "user")
    : null;
  if (fromMessages && typeof fromMessages === "object") {
    return toTextContent((fromMessages as { content?: unknown }).content);
  }

  if (typeof body.input === "string") return body.input;
  if (Array.isArray(body.input)) {
    const text = body.input
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const it = item as Record<string, unknown>;
        if (typeof it.content === "string") return it.content;
        if (typeof it.text === "string") return it.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }

  if (typeof body.prompt === "string") return body.prompt;
  return "";
}
