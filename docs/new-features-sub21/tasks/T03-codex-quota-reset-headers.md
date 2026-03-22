# T03 · Parse `x-codex-*` Headers for Precise Quota Reset Times

**Priority:** 🔴 P1 — UX for Codex Users
**Effort:** Medium (3–5h)
**Phase:** 1 — Current branch

---

## Problem

Codex (ChatGPT) responses include response headers with precise quota information:

- `x-codex-5h-usage` — tokens used in the 5-hour window
- `x-codex-5h-limit` — token limit for the 5-hour window
- `x-codex-5h-reset-at` — ISO timestamp when the 5h window resets
- `x-codex-7d-usage` — tokens used in the 7-day window
- `x-codex-7d-limit` — token limit for the 7-day window
- `x-codex-7d-reset-at` — ISO timestamp when the 7d window resets

Today OmniRoute falls back to a generic circuit-breaker cooldown (~5 minutes) when hitting Codex quota. The real reset could be hours away — causing repeated failed retries — or just seconds away — causing unnecessary skip of a valid account.

sub2api PR #357 implements full parsing of these headers to store exact reset timestamps per account.

---

## References

| Source          | Link                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| sub2api PR #357 | [feat(oauth): persist usage snapshots and window cooldown](https://github.com/Wei-Shaw/sub2api/pull/357) |
| Codex endpoint  | `https://chatgpt.com/backend-api/codex/responses`                                                        |
| Headers         | `x-codex-5h-*`, `x-codex-7d-*`                                                                           |
| Reset endpoint  | 7d priority over 5h                                                                                      |

---

## Implementation Steps

### Step 1 — Parse Headers in `codex.ts`

After every Codex response, extract and persist quota data:

```typescript
// In codex.ts after receiving response
function parseCodexQuotaHeaders(headers: Headers) {
  return {
    usage5h: parseFloat(headers.get("x-codex-5h-usage") ?? "0"),
    limit5h: parseFloat(headers.get("x-codex-5h-limit") ?? "Infinity"),
    resetAt5h: headers.get("x-codex-5h-reset-at") ?? null, // ISO string
    usage7d: parseFloat(headers.get("x-codex-7d-usage") ?? "0"),
    limit7d: parseFloat(headers.get("x-codex-7d-limit") ?? "Infinity"),
    resetAt7d: headers.get("x-codex-7d-reset-at") ?? null, // ISO string
  };
}

const quota = parseCodexQuotaHeaders(response.headers);

// Write to connection extra/metadata
await updateConnectionQuota(connection.id, {
  codex5hUsage: quota.usage5h,
  codex5hLimit: quota.limit5h,
  codex5hResetAt: quota.resetAt5h ? new Date(quota.resetAt5h).getTime() : null,
  codex7dUsage: quota.usage7d,
  codex7dLimit: quota.limit7d,
  codex7dResetAt: quota.resetAt7d ? new Date(quota.resetAt7d).getTime() : null,
});
```

### Step 2 — Persist to DB

In `src/lib/db/providers.ts`, extend connection extras to hold quota state:

```typescript
// Store as JSON in connection.extra column (already exists)
const extra = {
  ...existingExtra,
  codex_5h_usage: quota.usage5h,
  codex_5h_limit: quota.limit5h,
  codex_5h_reset_at: quota.resetAt5h,
  codex_7d_usage: quota.usage7d,
  codex_7d_limit: quota.limit7d,
  codex_7d_reset_at: quota.resetAt7d,
};
await updateConnectionExtra(connection.id, extra);
```

### Step 3 — Block Account Until Exact Reset Time

When Codex returns 429 (quota exhausted), use the parsed header to set precise block:

```typescript
// In codex.ts error handler on 429
const resetAt = quota.resetAt7d ?? quota.resetAt5h;
if (resetAt) {
  const resetMs = new Date(resetAt).getTime();
  await setConnectionRateLimitUntil(connection.id, resetMs);
  // Circuit breaker will check this timestamp before selecting account
}
```

### Step 4 — Display in Dashboard

In the Providers page, show Codex quota progress bars:

- 5h window: `usage5h / limit5h` with countdown to `resetAt5h`
- 7d window: `usage7d / limit7d` with countdown to `resetAt7d`

### Step 5 — Add nonce to test requests

When running connection tests, add a random nonce to avoid upstream response caching:

```typescript
body.nonce = crypto.randomUUID();
```

---

## Files to Change

| File                                       | Action                                                |
| ------------------------------------------ | ----------------------------------------------------- |
| `open-sse/executors/codex.ts`              | Parse `x-codex-*` headers after every response        |
| `src/lib/db/providers.ts`                  | `updateConnectionExtra()` with quota fields           |
| `src/lib/tokenHealthCheck.ts`              | Check `rateLimitUntil` before selecting Codex account |
| `src/app/(dashboard)/dashboard/providers/` | Quota progress bar + reset countdown                  |

---

## Acceptance Criteria

- [ ] After a Codex request, `x-codex-5h-*` and `x-codex-7d-*` headers are parsed
- [ ] Quota state is persisted in connection extras
- [ ] When quota exhausted, account is blocked until exact `reset_at` time (not 5min)
- [ ] Dashboard shows 5h and 7d quota bars for Codex connections
- [ ] Countdown timer visible
- [ ] On 429, the next request correctly skips the account until reset time
