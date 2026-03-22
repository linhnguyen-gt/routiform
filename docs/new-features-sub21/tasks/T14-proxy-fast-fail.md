# T14 · Proxy Fast-Fail on Dead Proxy

**Priority:** 🟡 P3 — UX for Proxy Users
**Effort:** Small (1–2h)
**Phase:** 3 — v3.x

---

## Problem

When a configured HTTP/SOCKS5 proxy is unreachable, every request through OmniRoute waits for the full `PROXY_TIMEOUT_MS` (default 30s) before failing. In a combo with 3 providers, this means 90 seconds before any response — or 30s of hanging even before the combo starts.

sub2api PR #1167 adds a "proxy fast-fail" that runs a quick TCP connectivity check before sending requests through the proxy.

---

## References

| Source                  | Link                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| sub2api PR #1167        | `fix: proxy-fast-fail`                                             |
| OmniRoute proxy timeout | `src/lib/apiBridgeServer.ts` — `DEFAULT_PROXY_TIMEOUT_MS = 30_000` |

---

## Implementation Steps

### Step 1 — Add Proxy Health Cache

In `src/lib/proxyHealth.ts` (new file):

```typescript
import { createConnection } from "node:net";

interface ProxyHealthEntry {
  healthy: boolean;
  checkedAt: number;
  ttlMs: number;
}

const proxyHealthCache = new Map<string, ProxyHealthEntry>();

/**
 * Fast TCP check to see if a proxy is reachable.
 * Caches results for `cacheTtlMs` to avoid checking on every request.
 */
export async function isProxyReachable(
  proxyUrl: string,
  timeoutMs = 2000,
  cacheTtlMs = 30_000
): Promise<boolean> {
  const cached = proxyHealthCache.get(proxyUrl);
  if (cached && Date.now() - cached.checkedAt < cached.ttlMs) {
    return cached.healthy;
  }

  const url = new URL(proxyUrl);
  const healthy = await new Promise<boolean>((resolve) => {
    const socket = createConnection(
      { host: url.hostname, port: parseInt(url.port || "8080") },
      () => {
        socket.destroy();
        resolve(true);
      }
    );
    socket.setTimeout(timeoutMs);
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });

  proxyHealthCache.set(proxyUrl, { healthy, checkedAt: Date.now(), ttlMs: cacheTtlMs });
  return healthy;
}
```

### Step 2 — Gate Requests Through Health Check

In `open-sse/chatCore.js`, before each request that uses a proxy:

```js
const proxyUrl = getConfiguredProxy(provider);
if (proxyUrl) {
  const proxyOk = await isProxyReachable(proxyUrl, 2000);
  if (!proxyOk) {
    logger.warn(`[Proxy Fast-Fail] Proxy ${proxyUrl} is unreachable. Skipping provider.`);
    // Return error or skip to next combo member
    throw new ProxyUnreachableError(`Proxy unreachable: ${proxyUrl}`);
  }
}
```

### Step 3 — Show Proxy Status in Health Dashboard

In `src/app/(dashboard)/dashboard/health/`:

- Show proxy status: 🟢 Reachable / 🔴 Unreachable / ⚪ Not configured
- Trigger manual re-check button

### Step 4 — Configurable Fast-Fail Timeout

Via settings or env var:

```
PROXY_FAST_FAIL_TIMEOUT_MS=2000   # TCP check timeout
PROXY_HEALTH_CACHE_TTL_MS=30000   # Cache duration
```

---

## Files to Change

| File                                    | Action                                              |
| --------------------------------------- | --------------------------------------------------- |
| `src/lib/proxyHealth.ts`                | NEW — `isProxyReachable()` with cache               |
| `open-sse/chatCore.js`                  | Gate Anthropic/OpenAI requests through health check |
| `src/app/(dashboard)/dashboard/health/` | Proxy status indicator                              |
| `src/lib/apiBridgeServer.ts`            | Integrate fast-fail for API bridge requests         |

---

## Acceptance Criteria

- [ ] Dead proxy detected in <2s instead of timing out at 30s
- [ ] Health check result cached for 30s (configurable)
- [ ] Clear log message when proxy fast-fail triggers
- [ ] Health dashboard shows proxy reachability
- [ ] Normal requests unaffected when proxy is healthy
