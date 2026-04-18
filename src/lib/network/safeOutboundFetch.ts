import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

type RetryStatusCode = number;

const DEFAULT_RETRY_STATUS_CODES: RetryStatusCode[] = [408, 429, 500, 502, 503, 504];
const BLOCKED_EXACT_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.aws.internal",
  "metadata",
  "169.254.169.254",
]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];
let dnsLookupImpl: typeof lookup = lookup;

export interface OutboundUrlGuardOptions {
  allowLoopback?: boolean;
  allowPrivateAddress?: boolean;
}

export interface SafeOutboundFetchOptions {
  guard?: OutboundUrlGuardOptions;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: RetryStatusCode[];
  retryUnsafeMethods?: boolean;
  maxRedirects?: number;
}

export class OutboundUrlPolicyError extends Error {
  code: string;
  status: number;
  target: string;

  constructor(code: string, message: string, target: string) {
    super(message);
    this.name = "OutboundUrlPolicyError";
    this.code = code;
    this.status = 400;
    this.target = target;
  }
}

function normalizeHostname(rawHostname: string): string {
  const lower = String(rawHostname || "")
    .trim()
    .toLowerCase();
  const withoutDot = lower.endsWith(".") ? lower.slice(0, -1) : lower;
  if (withoutDot.startsWith("[") && withoutDot.endsWith("]")) {
    return withoutDot.slice(1, -1);
  }
  return withoutDot;
}

function parseIpv4Octets(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return octets;
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = parseIpv4Octets(hostname);
  if (!octets) return false;

  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  if (normalized.includes(":")) {
    const ipv6 = normalized;
    if (ipv6 === "::" || ipv6 === "::1") return true;
    if (ipv6 === "0:0:0:0:0:0:0:1") return true;
    if (ipv6.startsWith("::ffff:") || ipv6.includes(":ffff:")) return true;
    if (ipv6.startsWith("fc") || ipv6.startsWith("fd")) return true;
    if (ipv6.startsWith("fe8") || ipv6.startsWith("fe9")) return true;
    if (ipv6.startsWith("fea") || ipv6.startsWith("feb")) return true;
    if (ipv6.startsWith("ff")) return true;
    return false;
  }
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("ff")) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true;
  if (BLOCKED_EXACT_HOSTS.has(normalized)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true;
  if (isPrivateIpv4(normalized)) return true;

  const ipVersion = isIP(normalized);
  if (ipVersion === 6 && isBlockedIpv6(normalized)) return true;
  return false;
}

function buildPolicyError(code: string, message: string, target: string): OutboundUrlPolicyError {
  return new OutboundUrlPolicyError(code, message, target);
}

function createAbortSignal(
  parentSignal: AbortSignal | null | undefined,
  timeoutMs?: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      controller.abort(new Error("Outbound fetch timeout"));
    }, timeoutMs);
  }

  const cleanup = () => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (parentSignal) parentSignal.removeEventListener("abort", abortFromParent);
  };

  return { signal: controller.signal, cleanup };
}

function canRetryMethod(method: string, retryUnsafeMethods: boolean): boolean {
  if (retryUnsafeMethods) return true;
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function shouldRetryError(error: unknown): boolean {
  if (error instanceof OutboundUrlPolicyError) return false;
  if (!(error instanceof Error)) return false;
  const name = (error.name || "").toLowerCase();
  const message = (error.message || "").toLowerCase();
  if (name === "aborterror" || name === "timeouterror") return true;
  return message.includes("timeout") || message.includes("network") || message.includes("fetch");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function nextRequestMethod(currentMethod: string, status: number): string {
  const method = currentMethod.toUpperCase();
  if (status === 303) return "GET";
  if ((status === 301 || status === 302) && method === "POST") return "GET";
  return method;
}

async function fetchWithSafeRedirects(
  targetUrl: URL,
  init: RequestInit,
  options: SafeOutboundFetchOptions,
  signal: AbortSignal
): Promise<Response> {
  const maxRedirects =
    Number.isFinite(options.maxRedirects) && Number(options.maxRedirects) >= 0
      ? Math.floor(Number(options.maxRedirects))
      : 5;

  let currentUrl = targetUrl;
  let method = String(init.method || "GET").toUpperCase();
  let body = init.body;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl.toString(), {
      ...init,
      method,
      body,
      redirect: "manual",
      signal,
    });

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    if (redirectCount >= maxRedirects) {
      response.body?.cancel().catch(() => {});
      throw buildPolicyError(
        "redirect_limit_exceeded",
        "Blocked outbound request: too many redirects",
        currentUrl.toString()
      );
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    const resolvedUrl = new URL(location, currentUrl);
    currentUrl = await assertSafeOutboundUrlResolved(resolvedUrl, options.guard);

    response.body?.cancel().catch(() => {});

    const nextMethod = nextRequestMethod(method, response.status);
    if (nextMethod === "GET" || nextMethod === "HEAD") {
      body = undefined;
    }
    method = nextMethod;
  }

  throw new Error("Outbound fetch failed after redirects");
}

export function isOutboundUrlPolicyError(error: unknown): error is OutboundUrlPolicyError {
  return error instanceof OutboundUrlPolicyError;
}

export function setSafeOutboundDnsLookupForTesting(lookupFn: typeof lookup) {
  dnsLookupImpl = lookupFn;
}

export function resetSafeOutboundDnsLookupForTesting() {
  dnsLookupImpl = lookup;
}

export function assertSafeOutboundUrl(
  target: string | URL,
  options: OutboundUrlGuardOptions = {}
): URL {
  const targetUrl = typeof target === "string" ? target : target.toString();
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    throw buildPolicyError(
      "invalid_url",
      `Blocked outbound request: invalid URL (${targetUrl})`,
      targetUrl
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw buildPolicyError(
      "unsupported_protocol",
      `Blocked outbound request: unsupported protocol ${url.protocol}`,
      url.toString()
    );
  }

  if (url.username || url.password) {
    throw buildPolicyError(
      "credentialed_url",
      "Blocked outbound request: URL credentials are not allowed",
      url.toString()
    );
  }

  const hostname = normalizeHostname(url.hostname);
  const allowLoopback = options.allowLoopback === true;
  const allowPrivate = options.allowPrivateAddress === true;

  const isLoopbackHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (isLoopbackHost && allowLoopback) {
    return url;
  }

  if (!allowPrivate && isBlockedHostname(hostname)) {
    throw buildPolicyError(
      "private_address_blocked",
      `Blocked outbound request: private/internal target not allowed (${hostname})`,
      url.toString()
    );
  }

  return url;
}

export async function assertSafeOutboundUrlResolved(
  target: string | URL,
  options: OutboundUrlGuardOptions = {}
): Promise<URL> {
  const url = assertSafeOutboundUrl(target, options);
  const hostname = normalizeHostname(url.hostname);
  const ipVersion = isIP(hostname);

  if (ipVersion > 0) {
    return url;
  }

  if (options.allowPrivateAddress === true) {
    return url;
  }

  let addresses: { address: string; family: number }[];
  try {
    const resolved = await dnsLookupImpl(hostname, { all: true, verbatim: true });
    addresses = Array.isArray(resolved) ? resolved : [resolved];
  } catch {
    throw buildPolicyError(
      "dns_resolution_failed",
      `Blocked outbound request: could not resolve host (${hostname})`,
      url.toString()
    );
  }
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw buildPolicyError(
      "dns_resolution_failed",
      `Blocked outbound request: could not resolve host (${hostname})`,
      url.toString()
    );
  }

  for (const addr of addresses) {
    const normalizedAddress = normalizeHostname(String(addr.address || ""));
    if (!normalizedAddress) {
      continue;
    }
    if (isBlockedHostname(normalizedAddress)) {
      throw buildPolicyError(
        "private_dns_resolution_blocked",
        `Blocked outbound request: DNS resolved to private/internal address (${normalizedAddress})`,
        url.toString()
      );
    }
  }

  return url;
}

export async function safeOutboundFetch(
  target: string | URL,
  init: RequestInit = {},
  options: SafeOutboundFetchOptions = {}
): Promise<Response> {
  const url = await assertSafeOutboundUrlResolved(target, options.guard);
  const retries = Number.isFinite(options.retries) ? Math.max(0, Number(options.retries)) : 0;
  const retryDelayMs =
    Number.isFinite(options.retryDelayMs) && Number(options.retryDelayMs) > 0
      ? Number(options.retryDelayMs)
      : 250;
  const retryOnStatuses = new Set(options.retryOnStatuses || DEFAULT_RETRY_STATUS_CODES);
  const method = String(init.method || "GET").toUpperCase();
  const retryUnsafeMethods = options.retryUnsafeMethods === true;

  let attempt = 0;
  while (attempt <= retries) {
    const { signal, cleanup } = createAbortSignal(init.signal, options.timeoutMs);
    try {
      const response = await fetchWithSafeRedirects(url, init, options, signal);
      const canRetry =
        attempt < retries &&
        canRetryMethod(method, retryUnsafeMethods) &&
        retryOnStatuses.has(response.status);
      if (!canRetry) {
        return response;
      }
      response.body?.cancel().catch(() => {});
    } catch (error) {
      const canRetry =
        attempt < retries && canRetryMethod(method, retryUnsafeMethods) && shouldRetryError(error);
      if (!canRetry) {
        throw error;
      }
    } finally {
      cleanup();
    }

    attempt += 1;
    await wait(retryDelayMs * attempt);
  }

  throw new Error("Outbound fetch failed after retries");
}
