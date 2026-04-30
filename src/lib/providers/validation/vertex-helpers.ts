export function parseVertexServiceAccount(apiKey: string): Record<string, unknown> | null {
  const trimmed = apiKey.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

export function hasVertexServiceAccountFields(sa: Record<string, unknown>) {
  return (
    typeof sa.client_email === "string" &&
    sa.client_email.trim().length > 0 &&
    typeof sa.private_key === "string" &&
    sa.private_key.trim().length > 0
  );
}
