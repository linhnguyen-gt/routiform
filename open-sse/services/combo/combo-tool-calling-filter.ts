import { supportsToolCalling } from "../modelCapabilities.ts";

export function filterOrderedModelsForToolCalling(
  orderedModels: string[],
  combo: { requireToolCalling?: boolean } | null | undefined,
  body: { tools?: unknown[] } | null | undefined,
  log: { info: (tag: string, msg: string) => void }
): string[] {
  if (!combo?.requireToolCalling || !Array.isArray(body?.tools) || body.tools.length === 0) {
    return orderedModels;
  }
  const before = orderedModels.length;
  const filtered = orderedModels.filter((m) => supportsToolCalling(m));
  if (filtered.length < before) {
    log.info(
      "COMBO",
      `requireToolCalling: removed ${before - filtered.length} model(s) without tool-calling support`
    );
  }
  return filtered;
}
