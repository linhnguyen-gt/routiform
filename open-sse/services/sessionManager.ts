/**
 * Session Fingerprinting — Phase 5
 *
 * Generates stable session IDs for sticky routing,
 * prompt caching, and per-session tracking.
 */

import { createHash } from "node:crypto";

interface SessionEntry {
  createdAt: number;
  lastActive: number;
  requestCount: number;
  connectionId: string | null;
}

interface SessionFingerprintOptions {
  provider?: string;
  connectionId?: string;
}

interface SessionMessage {
  role?: string;
  content?: unknown;
}

interface SessionBody {
  model?: string;
  system?: unknown;
  tools?: Array<{ name?: string; function?: { name?: string } }>;
  messages?: SessionMessage[];
  input?: SessionMessage[];
}

// In-memory session store with metadata
// key: sessionId → { createdAt, lastActive, requestCount, connectionId? }
const sessions = new Map<string, SessionEntry>();

// Auto-cleanup sessions older than 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000;
const _cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sessions) {
    if (now - entry.lastActive > SESSION_TTL_MS) sessions.delete(key);
  }
}, 60_000);
_cleanupTimer.unref();

/**
 * Generate a stable session fingerprint from request characteristics.
 * Same client + same conversation → same session ID.
 *
 * Fingerprint factors:
 * - System prompt hash (stable per conversation/tool)
 * - First user message hash (stable per conversation)
 * - Model name
 * - Provider (optional)
 * - Tools signature (sorted tool names)
 *
 * @param {object} body - Request body
 * @param {object} [options] - Extra context
 * @returns {string} Session ID (hex hash)
 */
export function generateSessionId(
  body: SessionBody | null | undefined,
  options: SessionFingerprintOptions = {}
): string | null {
  if (!body || typeof body !== "object") return null;
  const parts: string[] = [];

  // Model contributes to fingerprint
  if (body.model) parts.push(`model:${body.model}`);

  // Provider binding
  if (options.provider) parts.push(`provider:${options.provider}`);

  // System prompt hash (first 32 chars of system content)
  const systemPrompt = extractSystemPrompt(body);
  if (systemPrompt) {
    parts.push(`sys:${hashShort(systemPrompt)}`);
  }

  // First user message hash (identifies the conversation)
  const firstUser = extractFirstUserMessage(body);
  if (firstUser) {
    parts.push(`user0:${hashShort(firstUser)}`);
  }

  // Tools signature (sorted names)
  if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
    const toolNames = body.tools
      .map((t) => t.name || t.function?.name || "")
      .filter(Boolean)
      .sort()
      .join(",");
    if (toolNames) parts.push(`tools:${hashShort(toolNames)}`);
  }

  // Connection ID for sticky routing
  if (options.connectionId) parts.push(`conn:${options.connectionId}`);

  if (parts.length === 0) return null;

  const fingerprint = parts.join("|");
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);
}

/**
 * Touch or create a session
 */
export function touchSession(sessionId: string | null, connectionId: string | null = null): void {
  if (!sessionId) return;
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.lastActive = Date.now();
    existing.requestCount++;
    if (connectionId) existing.connectionId = connectionId;
  } else {
    sessions.set(sessionId, {
      createdAt: Date.now(),
      lastActive: Date.now(),
      requestCount: 1,
      connectionId,
    });
  }
}

/**
 * Get session info (for sticky routing decisions)
 */
export function getSessionInfo(sessionId: string | null): SessionEntry | null {
  if (!sessionId) return null;
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  if (Date.now() - entry.lastActive > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }
  return { ...entry };
}

/**
 * Get the bound connection for a session (sticky routing)
 */
export function getSessionConnection(sessionId: string | null): string | null {
  const info = getSessionInfo(sessionId);
  return info?.connectionId || null;
}

/**
 * Get session count (for dashboard)
 */
export function getActiveSessionCount(): number {
  return sessions.size;
}

/**
 * Get all active sessions (for dashboard)
 */
export function getActiveSessions(): Array<SessionEntry & { sessionId: string; ageMs: number }> {
  const now = Date.now();
  const result: Array<SessionEntry & { sessionId: string; ageMs: number }> = [];
  for (const [id, entry] of sessions) {
    if (now - entry.lastActive <= SESSION_TTL_MS) {
      result.push({ sessionId: id, ...entry, ageMs: now - entry.createdAt });
    }
  }
  return result;
}

/**
 * Clear all sessions (for testing)
 */
export function clearSessions(): void {
  sessions.clear();
}

/**
 * T04: Extract an external session ID from request headers.
 * Accepts both hyphenated and underscore forms for Nginx compatibility.
 * Nginx drops headers with underscores by default — use `underscores_in_headers on`
 * in nginx.conf, or use X-Session-Id (hyphenated) which passes cleanly.
 *
 * Ref: sub2api README + PR #634
 *
 * @param headers - Request headers (Headers object or plain object with .get())
 * @returns External session ID with "ext:" prefix, or null
 */
export function extractExternalSessionId(
  headers: Headers | { get?: (n: string) => string | null } | null | undefined
): string | null {
  if (!headers || typeof (headers as Headers).get !== "function") return null;
  const h = headers as Headers;
  const raw =
    h.get("x-session-id") ?? // Preferred: hyphenated (passes through Nginx)
    h.get("x-omniroute-session") ?? // OmniRoute-specific form
    h.get("session-id") ?? // Bare session-id
    null;
  if (!raw || !raw.trim()) return null;
  // Prefix "ext:" to ensure no collision with internal SHA-256 hash IDs
  return `ext:${raw.trim().slice(0, 64)}`; // max 64 chars to avoid abuse
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function hashShort(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 8);
}

function extractSystemPrompt(body: SessionBody | null | undefined): string | null {
  if (!body || typeof body !== "object") return null;
  // Claude format: body.system
  if (body.system) {
    return typeof body.system === "string" ? body.system : JSON.stringify(body.system);
  }
  // OpenAI format: messages[0].role === "system"
  if (Array.isArray(body.messages)) {
    const sys = body.messages.find((m) => m.role === "system" || m.role === "developer");
    if (sys) {
      return typeof sys.content === "string" ? sys.content : JSON.stringify(sys.content);
    }
  }
  return null;
}

function extractFirstUserMessage(body: SessionBody | null | undefined): string | null {
  if (!body || typeof body !== "object") return null;
  const messages = body.messages || body.input || [];
  if (!Array.isArray(messages)) return null;
  for (const msg of messages) {
    if (msg.role === "user") {
      return typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    }
  }
  return null;
}
