/**
 * API Key validation and sanitization utilities for the API Manager page.
 *
 * These are client-side helpers for key name input validation.
 * Server-side sanitization is handled by `@/shared/utils/inputSanitizer`.
 */

/** Maximum allowed length for API key display names. */
export const MAX_KEY_NAME_LENGTH = 100;

/** Maximum number of models that can be selected per key. */
export const MAX_SELECTED_MODELS = 500;

/**
 * Sanitize user input to prevent XSS in key names.
 * Strips angle brackets, quotes, and trims to max length.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/"/g, "")
    .replace(/'/g, "")
    .trim()
    .slice(0, MAX_KEY_NAME_LENGTH);
}

/**
 * Validate a key name for creation.
 * Must be non-empty, within length limit, and alphanumeric with spaces/hyphens/underscores.
 */
export function validateKeyName(
  name: string,
  t: (key: string, values?: Record<string, unknown>) => string
): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: t("keyNameRequired") };
  }
  if (name.length > MAX_KEY_NAME_LENGTH) {
    return { valid: false, error: t("keyNameTooLong", { max: MAX_KEY_NAME_LENGTH }) };
  }
  // Only allow alphanumeric, spaces, hyphens, underscores
  if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
    return { valid: false, error: t("keyNameInvalid") };
  }
  return { valid: true };
}
