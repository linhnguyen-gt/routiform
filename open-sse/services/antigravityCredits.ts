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

const CREDITS_EXHAUSTED_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours

/**
 * Per-account GOOGLE_ONE_AI credits-exhausted tracker.
 * Key: accountId (OAuth subject / email). Value: expiry timestamp.
 * When credits hit 0 we skip the credit retry for CREDITS_EXHAUSTED_TTL_MS.
 */
const creditsExhaustedUntil = new Map<string, number>();

/**
 * Per-account GOOGLE_ONE_AI remaining credit balance cache.
 * Populated from the final SSE chunk's `remainingCredits` field after every
 * successful credit-injected request. Keyed by accountId.
 */
const creditBalanceCache = new Map<string, number>();

/** Read the last-known GOOGLE_ONE_AI credit balance for a given account. */
export function getAntigravityRemainingCredits(accountId: string): number | null {
  const balance = creditBalanceCache.get(accountId);
  return balance !== undefined ? balance : null;
}

/** Update the balance cache — called when we parse `remainingCredits` from an SSE stream. */
export function updateAntigravityRemainingCredits(accountId: string, balance: number): void {
  creditBalanceCache.set(accountId, balance);
}

export function isCreditsExhausted(accountId: string): boolean {
  const until = creditsExhaustedUntil.get(accountId);
  if (!until) return false;
  if (Date.now() >= until) {
    creditsExhaustedUntil.delete(accountId);
    return false;
  }
  return true;
}

export function markCreditsExhausted(accountId: string): void {
  creditsExhaustedUntil.set(accountId, Date.now() + CREDITS_EXHAUSTED_TTL_MS);
}

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
