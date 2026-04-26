"use client";

import { useState, useEffect } from "react";
import {
  PROTOCOL_COLORS,
  PROVIDER_COLORS,
  getHttpStatusStyle as getStatusStyle,
} from "@/shared/constants/colors";
import {
  formatDuration,
  formatApiKeyLabel,
  computeTokensPerSecond,
  formatTokensPerSecondValue,
} from "@/shared/utils/formatting";

// ─── Payload Code Block ─────────────────────────────────────────────────────

function PayloadSection({ title, json, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await onCopy();
    if (success !== false) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] text-text-muted uppercase tracking-wider font-bold">{title}</h3>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
          aria-label={`Copy ${title}`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-4 rounded-xl bg-black/5 dark:bg-black/30 border border-border overflow-x-auto text-xs font-mono text-text-main max-h-[600px] overflow-y-auto leading-relaxed whitespace-pre-wrap break-words">
        {json}
      </pre>
    </div>
  );
}

// ─── Detail Modal ───────────────────────────────────────────────────────────

export default function RequestLoggerDetail({ log, detail, loading, onClose, onCopy }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const statusStyle = getStatusStyle(log.status);
  const protocolKey = log.sourceFormat || log.provider;
  const protocol = PROTOCOL_COLORS[protocolKey] ||
    PROTOCOL_COLORS[log.provider] || {
      bg: "#6B7280",
      text: "#fff",
      label: (protocolKey || log.provider || "-").toUpperCase(),
    };
  const providerColor = PROVIDER_COLORS[log.provider] || {
    bg: "#374151",
    text: "#fff",
    label: (log.provider || "-").toUpperCase(),
  };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      return (
        d.toLocaleDateString("pt-BR") + ", " + d.toLocaleTimeString("en-US", { hour12: false })
      );
    } catch {
      return iso;
    }
  };

  const toPrettyJson = (payload) => {
    if (payload === null || payload === undefined) return null;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  const pipelinePayloads = detail?.pipelinePayloads || null;
  const payloadSections = pipelinePayloads
    ? [
        ["clientRawRequest", "Client Raw Request"],
        ["clientRequest", "Client Request"],
        ["openaiRequest", "OpenAI Request"],
        ["providerRequest", "Provider Request"],
        ["providerResponse", "Provider Response"],
        ["clientResponse", "Client Response"],
        ["error", "Pipeline Error"],
      ]
        .map(([key, title]) => ({
          key,
          title,
          json: toPrettyJson(pipelinePayloads[key]),
        }))
        .filter((section) => section.json)
    : [];
  const requestJson = detail?.requestBody ? toPrettyJson(detail.requestBody) : null;
  const responseJson = detail?.responseBody ? toPrettyJson(detail.responseBody) : null;
  const tokenIn = detail?.tokens?.in ?? log.tokens?.in ?? 0;
  const tokenOut = detail?.tokens?.out ?? log.tokens?.out ?? 0;
  const tokenCacheRead = detail?.tokens?.cacheRead ?? log.tokens?.cacheRead ?? null;
  const tokenCacheCreation = detail?.tokens?.cacheCreation ?? log.tokens?.cacheCreation ?? null;
  const tokenReasoning = detail?.tokens?.reasoning ?? log.tokens?.reasoning ?? null;
  const durationMs = detail?.duration ?? log.duration ?? 0;
  const tokensPerSecond = computeTokensPerSecond(tokenOut, durationMs);

  // Extract reasoning effort from request body
  // Try providerRequest first (has transformed body with reasoning.effort set by executor)
  // Fall back to clientRawRequest if providerRequest not available
  const payloads = (detail as Record<string, unknown>)?.pipelinePayloads as
    | Record<string, unknown>
    | undefined;
  const providerRequestBody =
    (payloads?.providerRequest as Record<string, unknown>)?.body ??
    (detail as Record<string, unknown>)?.providerRequest?.body;
  const clientRequestBody = detail?.requestBody as Record<string, unknown> | undefined;

  const reasoningEffort =
    (providerRequestBody as Record<string, unknown>)?.reasoning?.effort ??
    (providerRequestBody as Record<string, unknown>)?.reasoning_effort ??
    (clientRequestBody as Record<string, unknown>)?.reasoning?.effort ??
    (clientRequestBody as Record<string, unknown>)?.reasoning_effort ??
    null;

  const formatNullableToken = (value) => {
    if (value === null || value === undefined) return "N/A";
    return Number(value).toLocaleString();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Request log detail"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-bg-primary border border-border rounded-xl w-full max-w-[900px] max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-bg-primary/95 backdrop-blur-sm rounded-t-xl">
          <div className="flex items-center gap-3">
            <span
              className="inline-block px-2.5 py-1 rounded text-xs font-bold"
              style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
            >
              {log.status}
            </span>
            <span className="font-bold text-lg">{log.method}</span>
            <span className="text-text-muted font-mono text-sm">{log.path}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close detail modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Request Overview - Time & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-bg-subtle rounded-xl border border-border">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Time</div>
              <div className="text-sm font-medium">{formatDate(log.timestamp)}</div>
            </div>
            <div className="p-4 bg-bg-subtle rounded-xl border border-border">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                Duration
              </div>
              <div className="text-sm font-medium">{formatDuration(durationMs)}</div>
            </div>
          </div>

          {/* Token Metrics */}
          <div className="p-4 bg-bg-subtle rounded-xl border border-border">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">
              Token Usage
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-muted">Input</span>
                <span className="px-2.5 py-1 rounded bg-primary/20 text-primary text-sm font-bold">
                  {tokenIn.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-muted">Output</span>
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                  {tokenOut.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-muted">Cache Read</span>
                <span className="px-2.5 py-1 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 text-sm font-bold">
                  {formatNullableToken(tokenCacheRead)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-muted">Cache Write</span>
                <span className="px-2.5 py-1 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-sm font-bold">
                  {formatNullableToken(tokenCacheCreation)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-muted">Reasoning</span>
                <span className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-sm font-bold">
                  {formatNullableToken(tokenReasoning)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-muted">Effort</span>
                <span className="px-2.5 py-1 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 text-sm font-bold">
                  {reasoningEffort || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="p-4 bg-bg-subtle rounded-xl border border-border">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
              Performance
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 text-sm font-bold">
                {formatTokensPerSecondValue(tokensPerSecond)} tok/s
              </span>
            </div>
          </div>

          {/* Model & Provider Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-bg-subtle rounded-xl border border-border">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">Model</div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Actual</span>
                  <span className="text-sm font-medium text-primary font-mono">{log.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Requested</span>
                  <span
                    className={`text-sm font-medium font-mono ${
                      (detail?.requestedModel || log.requestedModel) &&
                      (detail?.requestedModel || log.requestedModel) !== log.model
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-text-muted"
                    }`}
                  >
                    {detail?.requestedModel || log.requestedModel || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-bg-subtle rounded-xl border border-border">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">
                Provider
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Name</span>
                  <span
                    className="inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase"
                    style={{ backgroundColor: providerColor.bg, color: providerColor.text }}
                  >
                    {providerColor.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Protocol</span>
                  <span
                    className="inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase"
                    style={{ backgroundColor: protocol.bg, color: protocol.text }}
                  >
                    {protocol.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Account & Authentication */}
          <div className="p-4 bg-bg-subtle rounded-xl border border-border">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">
              Authentication
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-muted">Account</span>
                <span className="text-sm font-medium">{detail?.account || log.account || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-muted">API Key</span>
                <span
                  className="text-sm font-medium"
                  title={
                    detail?.apiKeyName ||
                    detail?.apiKeyId ||
                    log.apiKeyName ||
                    log.apiKeyId ||
                    "No API key"
                  }
                >
                  {formatApiKeyLabel(
                    detail?.apiKeyName || log.apiKeyName,
                    detail?.apiKeyId || log.apiKeyId
                  )}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-muted">Combo</span>
                {detail?.comboName || log.comboName ? (
                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 w-fit">
                    {detail?.comboName || log.comboName}
                  </span>
                ) : (
                  <span className="text-sm text-text-muted">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {(detail?.error || log.error) && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <div className="text-[10px] text-red-600 dark:text-red-400 uppercase tracking-wider mb-1 font-bold">
                Error
              </div>
              <div className="text-sm text-red-600 dark:text-red-300 font-mono">
                {detail?.error || log.error}
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-text-muted animate-pulse">
              Loading request details...
            </div>
          ) : (
            <>
              {payloadSections.length > 0 &&
                payloadSections.map((section) => (
                  <PayloadSection
                    key={section.key}
                    title={section.title}
                    json={section.json}
                    onCopy={() => onCopy(section.json)}
                  />
                ))}

              {payloadSections.length === 0 && responseJson && (
                <PayloadSection
                  title="Response Payload (Legacy)"
                  json={responseJson}
                  onCopy={() => onCopy(responseJson)}
                />
              )}

              {payloadSections.length === 0 && requestJson && (
                <PayloadSection
                  title="Request Payload (Legacy)"
                  json={requestJson}
                  onCopy={() => onCopy(requestJson)}
                />
              )}

              {payloadSections.length === 0 && !requestJson && !responseJson && !loading && (
                <div className="p-6 text-center text-text-muted">
                  <span className="material-symbols-outlined text-[32px] mb-2 block opacity-40">
                    info
                  </span>
                  <p className="text-sm">No payload data available for this log entry.</p>
                  <p className="text-xs mt-1">
                    Enable detailed logging first if you want the four-stage client/provider payload
                    view for new requests.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
