export function getJwtSecret(): Uint8Array | null {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    return null;
  }

  return new TextEncoder().encode(jwtSecret);
}

/**
 * Clear the JWT secret cache. No-op since caching was removed.
 * Kept for backward compatibility with existing code.
 * @deprecated Caching has been removed; this function is no longer needed.
 */
export function clearJwtSecretCache(): void {
  // No-op: caching removed to ensure fresh env values on each call
}
