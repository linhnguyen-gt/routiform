import { BaseExecutor } from "./base.ts";

/**
 * Cookie-authenticated Perplexity web session executor.
 * Disabled by default via feature flag in registry/helpers.
 */
export class PerplexityWebExecutor extends BaseExecutor {
  constructor() {
    super("perplexity-web", {
      id: "perplexity-web",
      baseUrl: "https://www.perplexity.ai/rest/sse/perplexity_ask",
    });
  }

  buildHeaders(credentials, stream = true) {
    return {
      "Content-Type": "application/json",
      ...(stream ? { Accept: "text/event-stream" } : {}),
      ...(credentials?.apiKey ? { Cookie: credentials.apiKey } : {}),
    } as Record<string, string>;
  }
}

export default PerplexityWebExecutor;
