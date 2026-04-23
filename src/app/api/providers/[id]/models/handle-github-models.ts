import { updateProviderConnection } from "@/models";
import { runWithProxyContext } from "@routiform/open-sse/utils/proxyFetch.ts";
import { safeOutboundFetch } from "@/lib/network/safeOutboundFetch";
import { refreshCopilotToken, refreshGitHubToken } from "@/sse/services/tokenRefresh";
import { asRecord } from "./json-utils";
import { OFFICIAL_GITHUB_COPILOT_MODELS } from "./github-copilot-official-models";
import type { GetModelsHandlerContext } from "./get-models-handler-context";

export async function handleGithubModels(
  ctx: GetModelsHandlerContext
): Promise<NextResponse | null> {
  if (ctx.provider !== "github") return null;

  const psd = asRecord(ctx.connection.providerSpecificData);
  let copilotToken =
    typeof psd.copilotToken === "string" && psd.copilotToken.trim().length > 0
      ? psd.copilotToken
      : null;
  const copilotTokenExpiresAt =
    typeof psd.copilotTokenExpiresAt === "number" ? psd.copilotTokenExpiresAt : null;
  const nowSec = Math.floor(Date.now() / 1000);

  if (!copilotToken || (copilotTokenExpiresAt && copilotTokenExpiresAt <= nowSec + 60)) {
    let githubAccessToken = ctx.accessToken;
    if (!githubAccessToken && typeof ctx.connection.refreshToken === "string") {
      try {
        const ghResult = await refreshGitHubToken(ctx.connection.refreshToken as string);
        if (ghResult?.accessToken) {
          githubAccessToken = ghResult.accessToken;
          await updateProviderConnection(ctx.connectionId, {
            accessToken: ghResult.accessToken,
            refreshToken: ghResult.refreshToken || (ctx.connection.refreshToken as string),
            ...(ghResult.expiresIn
              ? {
                  expiresAt: new Date(Date.now() + ghResult.expiresIn * 1000).toISOString(),
                  expiresIn: ghResult.expiresIn,
                }
              : {}),
          });
        }
      } catch {
        // Token refresh failed; continue with whatever token we have
      }
    }

    if (githubAccessToken) {
      try {
        const copilotResult = await refreshCopilotToken(githubAccessToken);
        if (copilotResult?.token) {
          copilotToken = copilotResult.token;
          const newPsd = {
            ...psd,
            copilotToken: copilotResult.token,
            copilotTokenExpiresAt: copilotResult.expiresAt,
          };
          await updateProviderConnection(ctx.connectionId, {
            providerSpecificData: JSON.stringify(newPsd),
          });
        }
      } catch {
        // Copilot token refresh failed; continue
      }
    }
  }

  if (!copilotToken) {
    return ctx.buildResponse({
      provider: ctx.provider,
      connectionId: ctx.connectionId,
      models: OFFICIAL_GITHUB_COPILOT_MODELS.map((m) => ({ ...m })),
      source: "local_catalog",
    });
  }

  let apiModelsMap = new Map<string, Record<string, unknown>>();
  try {
    const response = await runWithProxyContext(ctx.proxy, () =>
      safeOutboundFetch(
        "https://api.githubcopilot.com/models",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${copilotToken}`,
            "copilot-integration-id": "vscode-chat",
            "editor-version": "vscode/1.110.0",
            "editor-plugin-version": "copilot-chat/0.38.0",
            "user-agent": "GitHubCopilotChat/0.38.0",
            "openai-intent": "conversation-panel",
            "x-github-api-version": "2025-04-01",
            "X-Initiator": "user",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        { timeoutMs: 15_000 }
      )
    );

    if (response.ok) {
      const data = await response.json();
      const rawModels = Array.isArray(data.data) ? data.data : [];
      for (const item of rawModels) {
        const rec = asRecord(item);
        const id = String(rec.id ?? "").trim();
        if (!id) continue;
        const capabilities = asRecord(rec.capabilities);
        const limits = asRecord(capabilities.limits);
        const supports = asRecord(capabilities.supports);
        const endpoints = Array.isArray(rec.supported_endpoints) ? rec.supported_endpoints : [];
        apiModelsMap.set(id, {
          id,
          name: String(rec.name ?? id).trim(),
          owned_by: String(rec.vendor ?? "github").toLowerCase(),
          ...(endpoints.length > 0 ? { supportedEndpoints: endpoints } : {}),
          ...(typeof limits.max_context_window_tokens === "number"
            ? { inputTokenLimit: limits.max_context_window_tokens }
            : {}),
          ...(typeof limits.max_output_tokens === "number"
            ? { outputTokenLimit: limits.max_output_tokens }
            : {}),
          ...(supports.adaptive_thinking === true || supports.reasoning_effort
            ? { supportsThinking: true }
            : {}),
        });
      }
    }
  } catch {
    // API fetch failed; fall through to static list
  }

  const canonicalId = (id: string) =>
    id
      .toLowerCase()
      .replace(/-\d{8}$/g, "")
      .replace(/\./g, "-")
      .trim();

  const apiModelsByCanonical = new Map<string, Record<string, unknown>>();
  for (const [id, model] of apiModelsMap) {
    apiModelsByCanonical.set(canonicalId(id), model);
  }

  const models = OFFICIAL_GITHUB_COPILOT_MODELS.map((base) => {
    const apiData = apiModelsByCanonical.get(canonicalId(base.id));
    const merged: Record<string, unknown> = {
      ...base,
      ...(apiData
        ? {
            supportedEndpoints: apiData.supportedEndpoints ?? base.supportedEndpoints,
            ...(apiData.inputTokenLimit
              ? { inputTokenLimit: apiData.inputTokenLimit }
              : base.inputTokenLimit
                ? { inputTokenLimit: base.inputTokenLimit }
                : {}),
            ...(apiData.outputTokenLimit
              ? { outputTokenLimit: apiData.outputTokenLimit }
              : base.outputTokenLimit
                ? { outputTokenLimit: base.outputTokenLimit }
                : {}),
            supportsThinking: apiData.supportsThinking ?? base.supportsThinking ?? false,
          }
        : {}),
    };
    return merged;
  });

  return ctx.buildResponse({
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    models,
    source: apiModelsMap.size > 0 ? "api" : "local_catalog",
  });
}
