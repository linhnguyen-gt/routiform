export function shouldStripCloudCodeThinking(_provider: string, _model: string): boolean {
  return true;
}

export function stripCloudCodeThinkingConfig(
  body: Record<string, unknown>
): Record<string, unknown> {
  if (!body || typeof body !== "object") return body as Record<string, unknown>;
  const result = { ...body } as Record<string, unknown>;
  const request = result.request as Record<string, unknown> | undefined;
  if (request && typeof request === "object") {
    delete request.thinkingConfig;
    delete request.thinking_config;
  }
  return result;
}
