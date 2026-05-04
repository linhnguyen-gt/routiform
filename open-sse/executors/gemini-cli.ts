import { randomUUID } from "crypto";
import { BaseExecutor } from "./base.ts";
import { PROVIDERS, OAUTH_ENDPOINTS } from "../config/constants.ts";
import { getGeminiCliHeaders } from "../services/geminiCliHeaders.ts";
import { scrubProxyAndFingerprintHeaders } from "../services/antigravityHeaderScrub.ts";
import { obfuscateSensitiveWords } from "../services/antigravityObfuscation.ts";
import {
  shouldStripCloudCodeThinking,
  stripCloudCodeThinkingConfig,
} from "../services/antigravityThinkingConfig.ts";

const LOAD_CODE_ASSIST_URL = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
const ONBOARD_USER_URL = "https://cloudcode-pa.googleapis.com/v1internal:onboardUser";
const PROJECT_TTL_MS = 30_000;
const MAX_CACHE_SIZE = 100;
const LOAD_CODE_ASSIST_TIMEOUT_MS = 10_000;
const ONBOARD_TIMEOUT_MS = 10_000;
const ONBOARD_DELAY_MS = 5_000;
const DEFAULT_ONBOARD_TIER = "free-tier";
const LOAD_CODE_ASSIST_METADATA = Object.freeze({
  ideType: "IDE_UNSPECIFIED",
  platform: "PLATFORM_UNSPECIFIED",
  pluginType: "GEMINI",
});
const ONBOARD_METADATA = Object.freeze({
  ideType: "IDE_UNSPECIFIED",
  pluginType: "GEMINI",
});

// Per-account cache: accessToken -> { projectId, expiresAt }
const projectCache = new Map<string, { projectId: string; expiresAt: number }>();
const inflightRefresh = new Map<string, Promise<string | null>>();

type LoadCodeAssistResponse = {
  cloudaicompanionProject?: string;
};
type OnboardResponse = {
  managedProjectId?: string;
  defaultTierId?: string;
};

function normalizeGeminiModel(model: string): string {
  if (!model) return "unknown";
  const parts = model.split("/");
  const last = parts.length > 0 ? parts[parts.length - 1] : model;
  const lower = last.toLowerCase().trim();
  const known: Record<string, string> = {
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-3-flash": "gemini-3-flash",
    "gemini-3.1-flash": "gemini-3.1-flash",
    "gemini-3.0-pro": "gemini-3.0-pro",
    "gemini-3.1-pro-preview": "gemini-3.1-pro-preview",
  };
  return known[lower] || (lower.startsWith("gemini") ? lower : "unknown");
}

function generateGeminiCliRequestId(): string {
  return `agent-${randomUUID()}`;
}

function generateGeminiCliSessionId(): string {
  return `-${Date.now()}`;
}

type OnboardOptions = { attempts?: number };

function extractProjectId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as LoadCodeAssistResponse;
  return typeof data.cloudaicompanionProject === "string" ? data.cloudaicompanionProject : "";
}

function extractDefaultTierId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return DEFAULT_ONBOARD_TIER;
  const data = payload as OnboardResponse;
  return typeof data.defaultTierId === "string" ? data.defaultTierId : DEFAULT_ONBOARD_TIER;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export class GeminiCLIExecutor extends BaseExecutor {
  constructor() {
    super("gemini-cli", PROVIDERS["gemini-cli"]);
  }

  buildUrl(model: string, stream: boolean, urlIndex = 0) {
    void model;
    void urlIndex;
    const action = stream ? "streamGenerateContent?alt=sse" : "generateContent";
    return `${this.config.baseUrl}:${action}`;
  }

  buildHeaders(
    credentials: { accessToken: string },
    stream = true,
    _clientHeaders?: Record<string, string> | null,
    model?: string
  ): Record<string, string> {
    void _clientHeaders;
    const raw = getGeminiCliHeaders(
      normalizeGeminiModel(model || "unknown"),
      credentials.accessToken,
      stream ? "*/*" : "application/json"
    );
    const cleaned = scrubProxyAndFingerprintHeaders(raw);
    cleaned["x-routiform-source"] = "routiform";
    return cleaned;
  }

  async onboardManagedProject(
    accessToken: string,
    tierId = DEFAULT_ONBOARD_TIER,
    options: OnboardOptions = {},
    model = "unknown"
  ): Promise<string | null> {
    const currentModel = normalizeGeminiModel(model);
    const attempts =
      Number.isInteger(options.attempts) && options.attempts! > 0 ? Number(options.attempts) : 1;

    for (let i = 0; i < attempts; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, ONBOARD_DELAY_MS));
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ONBOARD_TIMEOUT_MS);

        const requestBody = {
          tierId,
          metadata: ONBOARD_METADATA,
        };

        let response;
        try {
          response = await fetch(ONBOARD_USER_URL, {
            method: "POST",
            headers: getGeminiCliHeaders(currentModel, accessToken, "application/json"),
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          console.warn(
            `[Routiform] GeminiCLI onboard attempt ${i + 1}/${attempts} failed: ${response.status} — ${body.slice(0, 200)}`
          );
          continue;
        }

        const data = (await response.json()) as OnboardResponse;
        if (data.managedProjectId && typeof data.managedProjectId === "string") {
          return data.managedProjectId.trim();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[Routiform] GeminiCLI onboard attempt ${i + 1}/${attempts} error: ${msg}`);
      }
    }

    return null;
  }

  async refreshProject(accessToken: string, model = "unknown"): Promise<string | null> {
    const cached = projectCache.get(accessToken);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.projectId;
    }

    const inflight = inflightRefresh.get(accessToken);
    if (inflight) return inflight;

    const promise = this._doRefresh(accessToken, model);
    inflightRefresh.set(accessToken, promise);
    try {
      return await promise;
    } finally {
      inflightRefresh.delete(accessToken);
    }
  }

  async _doRefresh(accessToken: string, model = "unknown"): Promise<string | null> {
    const currentModel = normalizeGeminiModel(model);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOAD_CODE_ASSIST_TIMEOUT_MS);

      let response;
      try {
        response = await fetch(LOAD_CODE_ASSIST_URL, {
          method: "POST",
          headers: getGeminiCliHeaders(currentModel, accessToken, "application/json"),
          body: JSON.stringify({
            metadata: LOAD_CODE_ASSIST_METADATA,
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

      const data = (await response.json()) as LoadCodeAssistResponse;
      let projectId = extractProjectId(data);

      if (!projectId) {
        console.warn(
          "[Routiform] loadCodeAssist returned no project — attempting managed project onboarding"
        );
        projectId = await this.onboardManagedProject(
          accessToken,
          extractDefaultTierId(data),
          {},
          currentModel
        );
      }

      if (!projectId) {
        console.warn(
          "[Routiform] GeminiCLI could not resolve a project — falling back to stored projectId"
        );
        return null;
      }

      if (projectCache.size >= MAX_CACHE_SIZE) {
        const now = Date.now();
        for (const [key, val] of projectCache) {
          if (val.expiresAt <= now) projectCache.delete(key);
        }
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

  async transformRequest(
    model: string,
    body: Record<string, unknown> | undefined,
    _stream: boolean,
    credentials: { accessToken: string; projectId?: string }
  ): Promise<Record<string, unknown>> {
    const currentModel = normalizeGeminiModel(model);
    const normalizedBody =
      shouldStripCloudCodeThinking(this.provider, currentModel) && body && typeof body === "object"
        ? stripCloudCodeThinkingConfig(body)
        : body;

    const bodyRecord =
      normalizedBody && typeof normalizedBody === "object"
        ? (normalizedBody as Record<string, unknown>)
        : {};
    const requestRecord =
      bodyRecord.request && typeof bodyRecord.request === "object"
        ? cloneRecord(bodyRecord.request as Record<string, unknown>)
        : {};

    const envelope: Record<string, unknown> = {
      model: currentModel,
      project: bodyRecord.project || credentials.projectId || "",
      user_prompt_id: bodyRecord.user_prompt_id || generateGeminiCliRequestId(),
      request: {
        ...requestRecord,
        session_id: requestRecord.session_id || generateGeminiCliSessionId(),
      },
    };

    for (const [key, value] of Object.entries(bodyRecord)) {
      if (!(key in envelope) && key !== "request") {
        envelope[key] = value;
      }
    }

    if (credentials.accessToken) {
      const freshProject = await this.refreshProject(credentials.accessToken, currentModel);
      if (freshProject) {
        envelope.project = freshProject;
      }
    }

    if (envelope.request && typeof envelope.request === "object") {
      const req = envelope.request as Record<string, unknown>;
      const contents = req.contents;
      if (Array.isArray(contents)) {
        for (const msg of contents as Array<{ parts?: Array<{ text?: string }> }>) {
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
    return envelope;
  }

  async refreshCredentials(
    credentials: { refreshToken: string; projectId?: string },
    log: {
      info?: (scope: string, msg: string) => void;
      error?: (scope: string, msg: string) => void;
    } | null
  ) {
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
