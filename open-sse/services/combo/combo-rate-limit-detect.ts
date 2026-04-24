import { ALL_ACCOUNTS_RATE_LIMITED_PATTERNS } from "./combo-constants.ts";

export function isAllAccountsRateLimitedResponse(
  status: number,
  contentType: string | null,
  errorText: string
): boolean {
  if (status !== 503) return false;
  if (!contentType?.includes("application/json")) return false;
  return ALL_ACCOUNTS_RATE_LIMITED_PATTERNS.some((p) => p.test(errorText));
}
