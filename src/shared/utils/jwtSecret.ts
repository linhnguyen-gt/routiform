import { randomBytes } from "crypto";

let cachedSecret: Uint8Array | null | undefined;
let hasLoggedWarning = false;

// For testing only - reset internal state
export function __resetJwtSecretCache(): void {
  cachedSecret = undefined;
  hasLoggedWarning = false;
}

export function getJwtSecret(): Uint8Array | null {
  // Return cached value if available (only for auto-generated secrets)
  if (cachedSecret !== undefined) {
    return cachedSecret;
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (jwtSecret) {
    // Don't cache env-based secrets to allow runtime changes
    return new TextEncoder().encode(jwtSecret);
  }

  // Auto-generate a random secret for dev/local environments
  // This allows login to work without explicit JWT_SECRET configuration
  const autoSecret = randomBytes(32).toString("base64");

  if (!hasLoggedWarning) {
    console.warn(
      "[JWT] JWT_SECRET not set. Using auto-generated secret for this session. " +
        "Set JWT_SECRET env var for persistent authentication across restarts."
    );
    hasLoggedWarning = true;
  }

  // Cache auto-generated secret to maintain consistency across calls
  cachedSecret = new TextEncoder().encode(autoSecret);
  return cachedSecret;
}

/**
 * Clear the JWT secret cache.
 * Call this after importing a backup to ensure the new JWT_SECRET is picked up.
 * Note: Middleware runs in Edge Runtime and won't see this change until restart.
 */
export function clearJwtSecretCache(): void {
  cachedSecret = undefined;
  hasLoggedWarning = false;
}
