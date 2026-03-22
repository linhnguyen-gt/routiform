# T07 · X-Forwarded-For Validation — Skip Non-IP Entries

**Priority:** 🟠 P2 — IP Rate Limiting Correctness
**Effort:** Tiny (<1h)
**Phase:** 2 — Next RC

---

## Problem

When running behind Nginx, Cloudflare, or other proxies, the `X-Forwarded-For` header may contain invalid entries like `"unknown"`:

```
X-Forwarded-For: unknown, 1.2.3.4, 10.0.0.1
```

If OmniRoute naively reads the first entry (`"unknown"`), IP-based rate limiting and IP filtering fail. The correct behavior is to skip non-valid IP entries and fall back to the first valid one, or to `req.socket.remoteAddress`.

---

## References

| Source           | Link                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| sub2api PR #1135 | [fix: skip invalid X-Forwarded-For entries in client IP detection](https://github.com/Wei-Shaw/sub2api/pull/1135) |
| Problem          | `unknown` in XFF breaks IP rate limiting                                                                          |
| Fix              | Skip non-IP entries, fall back to Gin `ClientIP()` equivalent                                                     |

---

## Implementation Steps

### Step 1 — Add IP Validation Helper

In `open-sse/chatCore.js` or a shared `src/lib/ipUtils.ts`:

```typescript
import { isIP } from "node:net"; // returns 4, 6, or 0

/**
 * Extract the real client IP from X-Forwarded-For header.
 * Skips invalid entries like "unknown" or empty strings.
 * Falls back to remoteAddress if no valid IP found.
 */
export function extractClientIp(
  xForwardedFor: string | null,
  remoteAddress: string | undefined
): string {
  if (xForwardedFor) {
    const entries = xForwardedFor.split(",").map((s) => s.trim());
    for (const entry of entries) {
      if (entry && isIP(entry) !== 0) {
        return entry; // first valid IP
      }
    }
  }
  return remoteAddress ?? "unknown";
}
```

### Step 2 — Use in Rate Limiter

Replace any current `req.headers["x-forwarded-for"]?.split(",")[0]` with:

```typescript
const clientIp = extractClientIp(
  (req.headers["x-forwarded-for"] as string) ?? null,
  req.socket?.remoteAddress
);
```

### Step 3 — Use in IP Allowlist/Blocklist

Same function should be used for IP filtering middleware.

### Step 4 — Add IP Whitespace Trimming

Also related (sub2api PR #1136): trim whitespace before validating patterns:

```typescript
// When checking IP against allowlist patterns
const cleanIp = clientIp.trim(); // remove accidental whitespace
```

---

## Files to Change

| File                      | Action                                    |
| ------------------------- | ----------------------------------------- |
| `src/lib/ipUtils.ts`      | NEW — `extractClientIp()` helper          |
| `open-sse/chatCore.js`    | Use `extractClientIp()` for rate limiting |
| `src/app/api/` middleware | Use `extractClientIp()` for IP filtering  |

---

## Acceptance Criteria

- [ ] `X-Forwarded-For: unknown, 1.2.3.4` correctly returns `1.2.3.4`
- [ ] All-invalid XFF falls back to `remoteAddress`
- [ ] Empty XFF falls back to `remoteAddress`
- [ ] IP whitelist/blocklist uses the same extraction logic
- [ ] No behavioral change when XFF is a valid single IP
