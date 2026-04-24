/**
 * Heuristic: many providers (incl. Kiro / AWS) send Unix epoch in **seconds**; JS Date expects ms.
 * 9–10 digit values are treated as seconds; 12+ digit values as milliseconds.
 */
function normalizeEpochNumberToMilliseconds(value: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const abs = Math.trunc(Math.abs(value));
  const digitCount = String(abs).length;
  if (digitCount <= 10) return value * 1000;
  return value;
}

/**
 * Parse reset date/time to ISO string
 * Handles multiple formats: Unix timestamp (seconds or ms), ISO date string, numeric strings.
 */
export function parseResetTime(resetValue: unknown): string | null {
  if (!resetValue) return null;

  try {
    let date: Date;
    if (resetValue instanceof Date) {
      date = resetValue;
    } else if (typeof resetValue === "number") {
      date = new Date(normalizeEpochNumberToMilliseconds(resetValue));
    } else if (typeof resetValue === "string") {
      const trimmed = resetValue.trim();
      if (/^\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        date = new Date(normalizeEpochNumberToMilliseconds(n));
      } else {
        date = new Date(resetValue);
      }
    } else {
      return null;
    }

    // Epoch-zero (1970-01-01) means no scheduled reset — treat as null
    if (date.getTime() <= 0) return null;

    return date.toISOString();
  } catch {
    return null;
  }
}
