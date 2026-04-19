import { BaseExecutor } from "./base.ts";

/**
 * Cookie-authenticated Grok web session executor.
 * Disabled by default via feature flag in registry/helpers.
 */
export class GrokWebExecutor extends BaseExecutor {
  constructor() {
    super("grok-web", {
      id: "grok-web",
      baseUrl: "https://grok.com/api/chat/completions",
    });
  }

  buildHeaders(credentials, stream = true) {
    const headers = {
      "Content-Type": "application/json",
      ...(stream ? { Accept: "text/event-stream" } : {}),
      ...(credentials?.apiKey ? { Cookie: credentials.apiKey } : {}),
    } as Record<string, string>;
    return headers;
  }
}

export default GrokWebExecutor;
