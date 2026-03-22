# T05 · Persist Rate-Limit State in DB (Survives Token Refresh)

**Priority:** 🟠 P2 — Routing Correctness
**Effort:** Medium (3–4h)
**Phase:** 2 — Next RC

---

## Problem

When an account hits a rate limit, OmniRoute records the state in memory (circuit breaker). However, when OAuth token refresh runs for that same account, it can accidentally clear the in-memory rate-limit state — causing the freshly-refreshed (but still rate-limited) account to be selected again immediately.

This creates a "rate-limit loop": the account gets selected, fails with 429, refreshes its token, gets selected again, fails again.

sub2api PR #1218 solves this by:

1. Persisting rate-limit state in the DB (not just in-memory)
2. Re-checking DB state before final account selection
3. Ensuring credentials-only updates (token refresh) don't clear rate-limit flags

---

## References

| Source           | Link                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| sub2api PR #1218 | [fix(openai): prevent rescheduling rate-limited accounts](https://github.com/Wei-Shaw/sub2api/pull/1218) |
| Problem          | Token refresh clears in-memory rate-limit state                                                          |
| fix              | DB-backed rate state + re-check before selection                                                         |

---

## Implementation Steps

### Step 1 — Add `rate_limited_until` to Connection Schema

In `src/lib/db/providers.ts`:

```typescript
// On connection write, persist rate limit state
async function setConnectionRateLimitUntil(
  connectionId: string,
  until: number | null // epoch ms, null = not rate limited
): Promise<void> {
  await db.run(`UPDATE provider_connections SET rate_limited_until = ? WHERE id = ?`, [
    until,
    connectionId,
  ]);
}

async function isConnectionRateLimited(connectionId: string): Promise<boolean> {
  const row = await db.get(`SELECT rate_limited_until FROM provider_connections WHERE id = ?`, [
    connectionId,
  ]);
  if (!row?.rate_limited_until) return false;
  return Date.now() < row.rate_limited_until;
}
```

### Step 2 — Migration

Add to migration 009 (or a new 010):

```sql
ALTER TABLE provider_connections ADD COLUMN rate_limited_until INTEGER DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_connections_rate_limit ON provider_connections(rate_limited_until);
```

### Step 3 — Write on 429

In `open-sse/chatCore.js` or executor error handler:

```js
if (status === 429) {
  const resetAt = parseRateLimitReset(response.headers) ?? Date.now() + 5 * 60 * 1000;
  await setConnectionRateLimitUntil(connectionId, resetAt);
}
```

### Step 4 — Check Before Selection

In `src/sse/services/auth.ts` account selection logic:

```typescript
// Before returning an account/connection
const rateLimited = await isConnectionRateLimited(connection.id);
if (rateLimited) {
  // Skip this connection, try next
  continue;
}
```

### Step 5 — Token Refresh Must NOT Clear Rate Limit

In OAuth token refresh flow:

```typescript
// Only update tokens — do NOT touch rate_limited_until
await db.run(
  `UPDATE provider_connections SET access_token = ?, refresh_token = ?, expires_at = ?
   WHERE id = ?`,
  [newToken, newRefresh, newExpiry, connectionId]
  // NO rate_limited_until update here
);
```

---

## Files to Change

| File                              | Action                                                       |
| --------------------------------- | ------------------------------------------------------------ |
| `src/lib/db/migrations/009_*.sql` | Add `rate_limited_until` column                              |
| `src/lib/db/providers.ts`         | `setConnectionRateLimitUntil()`, `isConnectionRateLimited()` |
| `src/sse/services/auth.ts`        | Check DB state before account selection                      |
| `open-sse/chatCore.js`            | Write rate-limit on 429 (with header-parsed reset time)      |
| `src/lib/oauth/`                  | Token refresh flows — don't touch rate_limited_until         |

---

## Acceptance Criteria

- [ ] 429 response writes `rate_limited_until` to DB
- [ ] Account selection skips connections with non-expired `rate_limited_until`
- [ ] Token refresh does not clear `rate_limited_until`
- [ ] After `rate_limited_until` expires, account is available again
- [ ] Dashboard shows "Rate Limited until HH:MM" for affected connections
