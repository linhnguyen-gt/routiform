import { CLI_TOOLS } from "./cliTools";

/**
 * Provider IDs toggled in Settings -> CLI Fingerprint.
 *
 * Source of truth:
 * - derive from visible CLI tools when a provider mapping exists
 * - keep legacy-compatible IDs that are still used by existing setups
 */
const TOOL_ID_TO_PROVIDER_ID: Record<string, string> = {
  kilo: "kilocode",
  copilot: "github",
};

const DERIVED_PROVIDER_IDS = Object.values(CLI_TOOLS)
  .map(
    (tool: Record<string, unknown>) => TOOL_ID_TO_PROVIDER_ID[String(tool.id)] ?? String(tool.id)
  )
  // "continue" currently has no provider id in AI_PROVIDERS
  .filter((providerId) => providerId !== "continue");

const LEGACY_PROVIDER_IDS = [
  // Keep to avoid breaking setups that saved old IDs
  "copilot",
  "kimi-coding",
  "qwen",
];

export const CLI_COMPAT_PROVIDER_IDS = Array.from(
  new Set([...DERIVED_PROVIDER_IDS, ...LEGACY_PROVIDER_IDS])
);
