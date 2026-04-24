export const KIRO_CODEWHISPERER_API = "https://codewhisperer.us-east-1.amazonaws.com";
/** Amazon Q uses the same JSON-RPC pattern on q.* for some operations (fallback). */
export const KIRO_Q_API_BASE = "https://q.us-east-1.amazonaws.com";

/**
 * Last-resort profile ARN when JWT / ListAvailableProfiles / DB all miss (9router-compatible).
 * Prefer storing real `profileArn` on the connection — this only unblocks GetUsageLimits shape.
 */
export const KIRO_DEFAULT_PROFILE_ARN_FALLBACK =
  "arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX";
