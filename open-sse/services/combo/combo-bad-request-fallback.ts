import { resolveProviderAlias } from "../model.ts";
import { isModelUnavailableError } from "../modelFamilyFallback.ts";
import { COMBO_BAD_REQUEST_FALLBACK_PATTERNS } from "./combo-constants.ts";

export function shouldFallbackComboBadRequest(
  status: number,
  errorText: string | null | undefined,
  providerHint: string | null | undefined
): boolean {
  if (status !== 400 || !errorText) return false;
  const message = String(errorText);
  const pid =
    typeof providerHint === "string" && providerHint.length > 0
      ? resolveProviderAlias(providerHint)
      : "";
  if (isModelUnavailableError(status, message)) {
    return true;
  }
  if (/request contains an invalid argument/i.test(message)) {
    return pid === "gemini" || pid === "vertex" || pid === "antigravity";
  }
  if (COMBO_BAD_REQUEST_FALLBACK_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }
  if (pid === "github" && /^\s*Bad Request\s*$/i.test(message.trim())) {
    return true;
  }
  return false;
}
