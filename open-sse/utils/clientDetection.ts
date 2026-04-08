export function isDroidCliUserAgent(userAgent: unknown): boolean {
  if (typeof userAgent !== "string") return false;

  const normalized = userAgent.toLowerCase();
  return (
    normalized.includes("codex-cli") ||
    normalized.includes("droid-cli") ||
    normalized.includes(" droid/")
  );
}
