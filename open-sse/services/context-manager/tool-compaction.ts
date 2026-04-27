import type { JsonRecord } from "./types.ts";

// Matches TOOL_RENAME_MAP in claudeCodeToolRemapper.ts — all known Claude Code tools
const PREFERRED_TOOLS = new Set([
  "bash",
  "read",
  "write",
  "edit",
  "glob",
  "grep",
  "task",
  "webfetch",
  "todowrite",
  "todoread",
  "question",
  "skill",
  "multiedit",
  "notebook",
]);

function normalizeToolNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function getToolName(tool: JsonRecord): string {
  const candidate =
    (tool as { function?: { name?: string }; name?: string })?.function?.name ||
    (tool as { name?: string })?.name ||
    "";
  return typeof candidate === "string" ? candidate : "";
}

function isCriticalRuntimeTool(name: string): boolean {
  const normalized = normalizeToolNameKey(name);
  if (!normalized) return false;
  return (
    normalized.startsWith("skills_") ||
    normalized.startsWith("memory_") ||
    normalized === "skills_execute" ||
    normalized === "skills_list" ||
    normalized === "skills_enable" ||
    normalized === "skills_executions"
  );
}

function collectRequiredTools(body?: JsonRecord): Set<string> {
  const required = new Set<string>();
  const rawToolChoice = body?.tool_choice;
  if (rawToolChoice && typeof rawToolChoice === "object" && !Array.isArray(rawToolChoice)) {
    const toolChoice = rawToolChoice as { type?: string; function?: { name?: string } };
    if (
      toolChoice.type === "function" &&
      typeof toolChoice.function?.name === "string" &&
      toolChoice.function.name.trim()
    ) {
      required.add(normalizeToolNameKey(toolChoice.function.name));
    }
  }
  return required;
}

function collectCalledTools(messages: JsonRecord[]): Set<string> {
  const called = new Set<string>();
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls as Array<{ function?: { name?: string }; name?: string }>) {
        const name = tc?.function?.name || tc?.name;
        if (typeof name === "string" && name.trim()) {
          called.add(normalizeToolNameKey(name));
        }
      }
    }
    if (Array.isArray(msg.content)) {
      for (const block of msg.content as Array<{ type?: string; name?: string }>) {
        if (
          (block?.type === "tool_use" || block?.type === "server_tool_use") &&
          typeof block.name === "string" &&
          block.name.trim()
        ) {
          called.add(normalizeToolNameKey(block.name));
        }
      }
    }
  }
  return called;
}

function getDescriptionBudget(
  tool: JsonRecord,
  requiredTools: Set<string>,
  calledTools: Set<string>
): number {
  const key = normalizeToolNameKey(getToolName(tool));
  if (requiredTools.has(key)) return 500;
  if (calledTools.has(key)) return 400;
  if (PREFERRED_TOOLS.has(key)) return 250;
  return 120;
}

export function compactToolDefinitions(
  tools: JsonRecord[],
  messages: JsonRecord[],
  maxTools: number = 48,
  body?: JsonRecord
): JsonRecord[] {
  const requiredToolNames = collectRequiredTools(body);
  const calledToolNames = collectCalledTools(messages);

  const ordered = [...tools].sort((a, b) => {
    const aKey = normalizeToolNameKey(getToolName(a));
    const bKey = normalizeToolNameKey(getToolName(b));

    const aRequired = requiredToolNames.has(aKey) ? 1 : 0;
    const bRequired = requiredToolNames.has(bKey) ? 1 : 0;
    if (aRequired !== bRequired) return bRequired - aRequired;

    const aCritical = isCriticalRuntimeTool(getToolName(a)) ? 1 : 0;
    const bCritical = isCriticalRuntimeTool(getToolName(b)) ? 1 : 0;
    if (aCritical !== bCritical) return bCritical - aCritical;

    const aUsed = calledToolNames.has(aKey) ? 1 : 0;
    const bUsed = calledToolNames.has(bKey) ? 1 : 0;
    if (aUsed !== bUsed) return bUsed - aUsed;

    const aPreferred = PREFERRED_TOOLS.has(aKey) ? 1 : 0;
    const bPreferred = PREFERRED_TOOLS.has(bKey) ? 1 : 0;
    return bPreferred - aPreferred;
  });

  const selected = ordered.slice(0, maxTools);

  const criticalNames = new Set(
    ordered
      .map((tool) => getToolName(tool))
      .filter((name) => typeof name === "string" && isCriticalRuntimeTool(name))
  );

  if (criticalNames.size > 0) {
    const selectedNames = new Set(selected.map((tool) => normalizeToolNameKey(getToolName(tool))));
    for (const criticalName of criticalNames) {
      const criticalKey = normalizeToolNameKey(criticalName);
      if (selectedNames.has(criticalKey)) continue;
      const criticalTool = ordered.find((tool) => getToolName(tool) === criticalName);
      if (!criticalTool) continue;
      if (selected.length >= maxTools && maxTools > 0) selected.pop();
      selected.unshift(criticalTool);
      selectedNames.add(criticalKey);
    }
  }

  if (requiredToolNames.size > 0) {
    const selectedNames = new Set(selected.map((tool) => normalizeToolNameKey(getToolName(tool))));
    for (const requiredName of requiredToolNames) {
      if (selectedNames.has(requiredName)) continue;
      const requiredTool = ordered.find(
        (tool) => normalizeToolNameKey(getToolName(tool)) === requiredName
      );
      if (!requiredTool) continue;
      if (selected.length >= maxTools && maxTools > 0) selected.pop();
      selected.unshift(requiredTool);
      selectedNames.add(requiredName);
    }
  }

  return selected.map((tool) => {
    const next = { ...tool };
    if (next.function && typeof next.function === "object") {
      const fn = { ...(next.function as Record<string, unknown>) };
      const budget = getDescriptionBudget(tool, requiredToolNames, calledToolNames);
      if (typeof fn.description === "string" && fn.description.length > budget) {
        fn.description = `${fn.description.slice(0, budget)}...`;
      }
      next.function = fn;
    }
    return next;
  });
}
