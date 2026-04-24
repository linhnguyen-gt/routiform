export function getRequestHeaderValue(
  headers: Headers | Record<string, string | string[] | undefined> | null | undefined,
  name: string
): string {
  if (!headers) return "";
  if (typeof (headers as Headers).get === "function") {
    const value = (headers as Headers).get(name) || (headers as Headers).get(name.toLowerCase());
    return typeof value === "string" ? value.trim() : "";
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const direct = record[name] ?? record[name.toLowerCase()] ?? record[name.toUpperCase()];
  if (direct === undefined) {
    const matchKey = Object.keys(record).find((key) => key.toLowerCase() === name.toLowerCase());
    if (matchKey) {
      const matched = record[matchKey];
      if (Array.isArray(matched)) {
        return typeof matched[0] === "string" ? matched[0].trim() : "";
      }
      return typeof matched === "string" ? matched.trim() : "";
    }
    return "";
  }
  if (Array.isArray(direct)) {
    return typeof direct[0] === "string" ? direct[0].trim() : "";
  }
  return typeof direct === "string" ? direct.trim() : "";
}
