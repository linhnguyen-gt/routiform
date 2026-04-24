/** In-memory atomic counter per combo for round-robin. Resets on server restart. */
export const rrCounters = new Map<string, number>();
