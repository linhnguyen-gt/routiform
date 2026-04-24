import type { JsonRecord } from "./types.ts";

export function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function toNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getFieldValue(source: unknown, snakeKey: string, camelKey: string): unknown {
  const obj = toRecord(source);
  return obj[snakeKey] ?? obj[camelKey] ?? null;
}

export function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}
