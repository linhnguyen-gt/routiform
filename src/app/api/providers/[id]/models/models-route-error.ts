import { isOutboundUrlPolicyError } from "@/lib/network/safeOutboundFetch";

export function toModelsRouteError(error: unknown): { message: string; status: number } {
  if (isOutboundUrlPolicyError(error)) {
    return {
      message: error.message,
      status: 400,
    };
  }
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();
    if (
      name === "aborterror" ||
      name === "timeouterror" ||
      message.includes("timeout") ||
      message.includes("aborted due to timeout")
    ) {
      return { message: "Provider models fetch timeout", status: 504 };
    }
  }
  return { message: "Failed to fetch models", status: 500 };
}
