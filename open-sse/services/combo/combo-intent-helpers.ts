import { DEFAULT_INTENT_CONFIG, type IntentClassifierConfig } from "../intentClassifier.ts";

function mapIntentToTaskType(intent: string): string {
  switch (intent) {
    case "code":
      return "coding";
    case "reasoning":
      return "analysis";
    case "simple":
      return "default";
    case "medium":
    default:
      return "default";
  }
}

function toStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export function getIntentConfig(
  settings: Record<string, unknown> | null | undefined,
  combo: Record<string, unknown> | null | undefined
): IntentClassifierConfig {
  const cx = combo as Record<string, unknown> | null | undefined;
  const autoCfg = cx?.autoConfig as Record<string, unknown> | undefined;
  const cfg = cx?.config as Record<string, unknown> | undefined;
  const cfgAuto = cfg?.auto as Record<string, unknown> | undefined;

  const comboIntentConfig =
    (autoCfg?.intentConfig as Record<string, unknown> | undefined) ||
    (cfgAuto?.intentConfig as Record<string, unknown> | undefined) ||
    (cfg?.intentConfig as Record<string, unknown> | undefined) ||
    {};

  const s = settings || {};
  return {
    ...DEFAULT_INTENT_CONFIG,
    ...(comboIntentConfig as unknown as IntentClassifierConfig),
    ...(typeof s.intentDetectionEnabled === "boolean" ? { enabled: s.intentDetectionEnabled } : {}),
    ...(Number.isFinite(Number(s.intentSimpleMaxWords))
      ? { simpleMaxWords: Number(s.intentSimpleMaxWords) }
      : {}),
    ...(toStringArray(s.intentExtraCodeKeywords).length > 0
      ? { extraCodeKeywords: toStringArray(s.intentExtraCodeKeywords) }
      : {}),
    ...(toStringArray(s.intentExtraReasoningKeywords).length > 0
      ? { extraReasoningKeywords: toStringArray(s.intentExtraReasoningKeywords) }
      : {}),
    ...(toStringArray(s.intentExtraSimpleKeywords).length > 0
      ? { extraSimpleKeywords: toStringArray(s.intentExtraSimpleKeywords) }
      : {}),
  };
}

export { mapIntentToTaskType };
