/**
 * Internal helpers shared by registry modules.
 */

import { platform, arch } from "os";
import type { RegistryModel } from "./registry-types.ts";

export function isProviderEnabledByFlag(flagName?: string): boolean {
  if (!flagName) return true;
  return process.env[flagName] === "true";
}

export const KIMI_CODING_SHARED = {
  format: "claude",
  executor: "default",
  baseUrl: "https://api.kimi.com/coding/v1/messages",
  authHeader: "x-api-key",
  headers: {
    "Anthropic-Version": "2023-06-01",
    "Anthropic-Beta": "claude-code-20250219,interleaved-thinking-2025-05-14",
  },
  models: [
    { id: "kimi-k2.5", name: "Kimi K2.5", forceParams: { temperature: 1 } },
    { id: "kimi-k2.5-thinking", name: "Kimi K2.5 Thinking", forceParams: { temperature: 1 } },
    { id: "kimi-latest", name: "Kimi Latest" },
  ] as RegistryModel[],
} as const;

export function mapStainlessOs() {
  switch (platform()) {
    case "darwin":
      return "MacOS";
    case "win32":
      return "Windows";
    case "linux":
      return "Linux";
    default:
      return `Other::${platform()}`;
  }
}

export function mapStainlessArch() {
  switch (arch()) {
    case "x64":
      return "x64";
    case "arm64":
      return "arm64";
    case "ia32":
      return "x86";
    default:
      return `other::${arch()}`;
  }
}
