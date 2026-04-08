import type { ProviderModelsApiErrorBody } from "./[id]/types";

export async function formatProviderModelsErrorResponse(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ProviderModelsApiErrorBody;
    const err = data?.error;

    if (Array.isArray(err?.details) && err.details.length > 0) {
      return err.details
        .map((detail) => {
          const field = typeof detail.field === "string" && detail.field ? detail.field : "?";
          const message = typeof detail.message === "string" ? detail.message : "";
          return message ? `${field}: ${message}` : field;
        })
        .join("; ");
    }

    if (typeof err?.message === "string" && err.message.trim()) {
      return err.message.trim();
    }
  } catch {
    // ignore
  }

  const statusText = res.statusText?.trim();
  return statusText || `HTTP ${res.status}`;
}

export function normalizeAndValidateHttpBaseUrl(
  rawValue: unknown,
  fallbackUrl: string
): { value: string | null; error: string | null } {
  const value = (typeof rawValue === "string" ? rawValue.trim() : "") || fallbackUrl;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { value: null, error: "Base URL must use http or https" };
    }
    return { value, error: null };
  } catch {
    return { value: null, error: "Base URL must be a valid URL" };
  }
}
