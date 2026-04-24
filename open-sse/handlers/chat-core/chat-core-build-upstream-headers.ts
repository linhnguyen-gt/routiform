import { getModelUpstreamExtraHeaders } from "@/lib/localDb";
import packageJson from "../../../package.json";
import { resolveModelAlias } from "../../services/modelDeprecation.ts";
import type { RawRequestLike } from "../types/chat-core.ts";
import { getRequestHeaderValue } from "./chat-core-request-header.ts";
import { sanitizeGithubInitiatorHeaderValue } from "./chat-core-flags.ts";

export function createBuildUpstreamHeadersForExecute({
  provider,
  model,
  resolvedModel,
  effectiveModel,
  sourceFormat,
  connectionCustomUserAgent,
  clientRawRequest,
}: {
  provider: string;
  model: string;
  resolvedModel: string;
  effectiveModel: string;
  sourceFormat: string;
  connectionCustomUserAgent: string;
  clientRawRequest?: RawRequestLike | null;
}) {
  return (modelToCall: string): Record<string, string> => {
    const name = packageJson.name;
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    const upstreamHeaders =
      modelToCall === effectiveModel
        ? {
            ...getModelUpstreamExtraHeaders(provider || "", model || "", sourceFormat),
            ...getModelUpstreamExtraHeaders(provider || "", resolvedModel || "", sourceFormat),
          }
        : (() => {
            const r = resolveModelAlias(modelToCall);
            return {
              ...getModelUpstreamExtraHeaders(provider || "", modelToCall || "", sourceFormat),
              ...getModelUpstreamExtraHeaders(provider || "", r || "", sourceFormat),
            };
          })();

    if (connectionCustomUserAgent) {
      upstreamHeaders["User-Agent"] = connectionCustomUserAgent;
      if ("user-agent" in upstreamHeaders) {
        upstreamHeaders["user-agent"] = connectionCustomUserAgent;
      }
    }

    if (provider === "openrouter") {
      const appTitle = capitalized;
      if (appTitle) {
        upstreamHeaders["X-OpenRouter-Title"] = appTitle;
        upstreamHeaders["X-Title"] = appTitle;
      }
    }

    if (provider === "github") {
      for (const headerName of Object.keys(upstreamHeaders)) {
        if (headerName.toLowerCase() === "x-initiator") {
          delete upstreamHeaders[headerName];
        }
      }
      const rawInitiator = getRequestHeaderValue(clientRawRequest?.headers, "x-initiator");
      const safeInitiator = sanitizeGithubInitiatorHeaderValue(rawInitiator);
      if (safeInitiator) {
        upstreamHeaders["X-Initiator"] = safeInitiator;
      }
    }

    return upstreamHeaders;
  };
}
