/**
 * Google One AI credits injection for Antigravity.
 *
 * When Antigravity returns a quota_exhausted 429, CLIProxyAPI retries the
 * request with `enabledCreditTypes: ["GOOGLE_ONE_AI"]` injected into the
 * body. This uses the user's Google One AI credit balance for the retry,
 * which is often available on Pro accounts.
 *
 * Based on CLIProxyAPI's antigravity_executor.go line 268.
 */

import { isCreditsDisabled, recordCreditsFailure } from "./antigravity429Engine.ts";

/**
 * Inject enabledCreditTypes into the request body for a credits retry.
 * Returns a new body object with the field added.
 */
export function injectCreditsField(body: Record<string, unknown>): Record<string, unknown> {
  return {
    ...body,
    enabledCreditTypes: ["GOOGLE_ONE_AI"],
  };
}

/**
 * Determine if a credits retry should be attempted for this auth key.
 * Returns false if credits are disabled (too many failures) or if the
 * config flag is off.
 */
export function shouldRetryWithCredits(authKey: string, creditsEnabled: boolean): boolean {
  if (!creditsEnabled) return false;
  if (isCreditsDisabled(authKey)) return false;
  return true;
}

/**
 * Handle a credits retry failure. Tracks the failure and returns
 * true if credits are now disabled for this auth key.
 */
export function handleCreditsFailure(authKey: string): boolean {
  return recordCreditsFailure(authKey);
}
