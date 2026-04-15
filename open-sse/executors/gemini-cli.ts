import { BaseExecutor } from "./base.ts";
import { PROVIDERS, OAUTH_ENDPOINTS } from "../config/constants.ts";
import { geminiCLIUserAgent, googApiClientHeader } from "../services/antigravityHeaders.ts";
import { scrubProxyAndFingerprintHeaders } from "../services/antigravityHeaderScrub.ts";
import { obfuscateSensitiveWords } from "../services/antigravityObfuscation.ts";

const LOAD_CODE_ASSIST_URL = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
const PROJECT_TTL_MS = 30_000; // 30 seconds — matches native Gemini CLI
const MAX_CACHE_SIZE = 100;
const LOAD_CODE_ASSIST_TIMEOUT_MS = 10_000; // 10 seconds timeout

// Per-account cache: accessToken -> { projectId, expiresAt }
const projectCache = new Map<string, { projectId: string; expiresAt: number }>();
// In-flight deduplication: prevents thundering herd on cache miss
const inflightRefresh = new Map<string, Promise<string | null>>();

export class GeminiCLIExecutor extends BaseExecutor {
  constructor() {
    super("gemini-cli", PROVIDERS["gemini-cli"]);
  }

  buildUrl(model, stream, _urlIndex = 0) {
    const action = stream ? "streamGenerateContent?alt=sse" : "generateContent";
    return `${this.config.baseUrl}:${action}`;
  }

  buildHeaders(credentials, stream = true) {
    const raw = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.accessToken}`,
      // Dynamic headers matching native GeminiCLI client
      "User-Agent": geminiCLIUserAgent(this._currentModel || "unknown"),
      "X-Goog-Api-Client": googApiClientHeader(),
      ...(stream && { Accept: "text/event-stream" }),
    };
    return scrubProxyAndFingerprintHeaders(raw);
  }

  // Track current model for dynamic UA (set by transformRequest)
  private _currentModel = "unknown";

  /**
   * Fetch the current cloudaicompanionProject via loadCodeAssist API.
   * Native Gemini CLI refreshes this every 30 seconds — Routiform stores it once
   * at OAuth connection time, so it goes stale. This method keeps it fresh.
   */
  async refreshProject(accessToken: string): Promise<string | null> {
    // Check cache
    const cached = projectCache.get(accessToken);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.projectId;
    }

    // Deduplicate in-flight requests (thundering herd prevention)
    const inflight = inflightRefresh.get(accessToken);
    if (inflight) return inflight;

    const promise = this._doRefresh(accessToken);
    inflightRefresh.set(accessToken, promise);
    try {
      return await promise;
    } finally {
      inflightRefresh.delete(accessToken);
    }
  }

  async _doRefresh(accessToken: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOAD_CODE_ASSIST_TIMEOUT_MS);

      let response;
      try {
        response = await fetch(LOAD_CODE_ASSIST_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metadata: {
              ideType: "IDE_UNSPECIFIED",
              platform: "PLATFORM_UNSPECIFIED",
              pluginType: "GEMINI",
            },
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        console.warn(
          `[Routiform] loadCodeAssist returned ${response.status} — falling back to stored projectId`
        );
        return null;
      }

      const data = await response.json();
      let projectId = "";
      if (typeof data.cloudaicompanionProject === "string") {
        projectId = data.cloudaicompanionProject.trim();
      } else if (typeof data.cloudaicompanionProject?.id === "string") {
        projectId = data.cloudaicompanionProject.id.trim();
      }

      if (!projectId) {
        console.warn(
          "[Routiform] loadCodeAssist returned no project — falling back to stored projectId"
        );
        return null;
      }

      // Cache for 30 seconds (evict stale entries if cache is full)
      if (projectCache.size >= MAX_CACHE_SIZE) {
        const now = Date.now();
        for (const [key, val] of projectCache) {
          if (val.expiresAt <= now) projectCache.delete(key);
        }
        // If still full, evict the oldest entry (Map maintains insertion order)
        if (projectCache.size >= MAX_CACHE_SIZE) {
          const firstKey = projectCache.keys().next().value;
          if (firstKey !== undefined) projectCache.delete(firstKey);
        }
      }
      projectCache.set(accessToken, {
        projectId,
        expiresAt: Date.now() + PROJECT_TTL_MS,
      });

      return projectId;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[Routiform] loadCodeAssist failed (${msg}) — falling back to stored projectId`);
      return null;
    }
  }

  async transformRequest(model, body, stream, credentials) {
    // Track model for dynamic User-Agent
    this._currentModel = model || "unknown";

    // Refresh the project ID via loadCodeAssist (cached for 30s).
    if (body && typeof body === "object" && body.request && credentials.accessToken) {
      const freshProject = await this.refreshProject(credentials.accessToken);
      if (freshProject) {
        body.project = freshProject;
      }

      // Obfuscate sensitive client names in user content
      const contents = body.request?.contents;
      if (Array.isArray(contents)) {
        for (const msg of contents) {
          if (Array.isArray(msg.parts)) {
            for (const part of msg.parts) {
              if (typeof part.text === "string") {
                part.text = obfuscateSensitiveWords(part.text);
              }
            }
          }
        }
      }
    }
    return body;
  }

  async refreshCredentials(credentials, log) {
    if (!credentials.refreshToken) return null;

    try {
      const response = await fetch(OAUTH_ENDPOINTS.google.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credentials.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Routiform] GeminiCLI refresh token error: ${errorText}`);
        return null;
      }

      const tokens = await response.json();
      log?.info?.("TOKEN", "GeminiCLI refreshed");

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || credentials.refreshToken,
        expiresIn: tokens.expires_in,
        projectId: credentials.projectId,
      };
    } catch (error) {
      console.error(`[Routiform] GeminiCLI refresh error: ${error}`);
      return null;
    }
  }
}

export default GeminiCLIExecutor;
