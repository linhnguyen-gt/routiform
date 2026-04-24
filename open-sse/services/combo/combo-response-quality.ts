/**
 * Validate that a successful (HTTP 200) non-streaming response actually contains
 * meaningful content. Returns { valid: true } or { valid: false, reason }.
 */
export async function validateResponseQuality(
  response: Response,
  isStreaming: boolean,
  _log: { warn?: (...args: unknown[]) => void }
): Promise<{ valid: boolean; reason?: string; clonedResponse?: Response }> {
  if (isStreaming) return { valid: true };

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json") && !contentType.includes("text/")) {
    return { valid: true };
  }

  let cloned: Response;
  try {
    cloned = response.clone();
  } catch {
    return { valid: true };
  }

  let text: string;
  try {
    text = await cloned.text();
  } catch {
    return { valid: true };
  }

  if (!text || text.trim().length === 0) {
    return { valid: false, reason: "empty response body" };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    if (text.startsWith("data:")) return { valid: true };
    return { valid: false, reason: "response is not valid JSON" };
  }

  const choices = json?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    if (json?.output || json?.result || json?.data || json?.response) return { valid: true };
    if (json?.error) {
      const err = json.error as Record<string, unknown>;
      return {
        valid: false,
        reason: `upstream error in 200 body: ${err?.message || JSON.stringify(json.error).substring(0, 200)}`,
      };
    }
    return { valid: true };
  }

  const firstChoice = choices[0] as Record<string, unknown>;
  const message = (firstChoice?.message || firstChoice?.delta) as
    | Record<string, unknown>
    | undefined;
  if (!message) {
    return { valid: false, reason: "choice has no message object" };
  }

  const content = message.content;
  const toolCalls = message.tool_calls;
  const hasContent = content !== null && content !== undefined && content !== "";
  const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;

  if (!hasContent && !hasToolCalls) {
    return { valid: false, reason: "empty content and no tool_calls in response" };
  }

  return { valid: true };
}
