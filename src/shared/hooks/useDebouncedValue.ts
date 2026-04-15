"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a value by the given delay in milliseconds.
 * Useful for search inputs where you want to avoid re-filtering on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
