# T08 · Per-API-Key Session Limit (`max_sessions`)

**Priority:** 🟠 P2 — Abuse Prevention
**Effort:** Medium (3–5h)
**Phase:** 2 — Next RC

---

## Problem

A single API key can maintain unlimited concurrent sticky sessions. In shared or multi-user setups, this means one key can monopolize all available upstream accounts by opening many parallel conversations. There's no way for an admin to cap concurrency at the key level.

sub2api PR #634 adds a `max_sessions` field per user, enforced via Redis Lua scripts that count active sessions per key.

---

## References

| Source          | Link                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| sub2api PR #634 | [fix: stabilize session hash + add user-level session limit](https://github.com/Wei-Shaw/sub2api/pull/634) |
| Redis key       | `session_limit:user:{userID}`                                                                              |
| HTTP response   | `429` with message "You have reached the maximum number of active sessions"                                |
| Default         | `max_sessions = 0` = unlimited (backward compatible)                                                       |

---

## Implementation Steps

### Step 1 — Add `max_sessions` to API Keys

Extend the `api_keys` table in a migration:

```sql
ALTER TABLE api_keys ADD COLUMN max_sessions INTEGER DEFAULT 0;
-- 0 = unlimited
```

### Step 2 — Track Active Sessions Per Key

In `open-sse/services/sessionManager.ts`, maintain an in-memory map of active sessions per API key:

```typescript
// Map: apiKeyId → Set<sessionId>
const activeSessionsByKey = new Map<string, Set<string>>();

function getActiveSessionCount(apiKeyId: string): number {
  return activeSessionsByKey.get(apiKeyId)?.size ?? 0;
}

function registerSession(apiKeyId: string, sessionId: string): void {
  if (!activeSessionsByKey.has(apiKeyId)) {
    activeSessionsByKey.set(apiKeyId, new Set());
  }
  activeSessionsByKey.get(apiKeyId)!.add(sessionId);
}

function unregisterSession(apiKeyId: string, sessionId: string): void {
  activeSessionsByKey.get(apiKeyId)?.delete(sessionId);
}
```

### Step 3 — Enforce Limit Before Session Creation

In `open-sse/chatCore.js` before session binding:

```js
const maxSessions = apiKey.max_sessions ?? 0;
if (maxSessions > 0) {
  const current = getActiveSessionCount(apiKeyId);
  if (current >= maxSessions) {
    return res.status(429).json({
      error: {
        message:
          `You have reached the maximum number of active sessions (${maxSessions}). ` +
          `Please close unused sessions or wait for them to expire.`,
        type: "session_limit_exceeded",
        code: "SESSION_LIMIT_EXCEEDED",
      },
    });
  }
}
// Proceed with session registration
registerSession(apiKeyId, sessionId);
```

### Step 4 — Clean Up on Session End

When a streaming response ends or aborts:

```js
req.on("close", () => {
  unregisterSession(apiKeyId, sessionId);
});
```

### Step 5 — UI in API Manager

In `src/app/(dashboard)/dashboard/api-manager/`:

- Add "Max Sessions" input field (0 = unlimited)
- Show current active session count per key
- Show "∞" when max_sessions = 0

---

## Files to Change

| File                                         | Action                                 |
| -------------------------------------------- | -------------------------------------- |
| `src/lib/db/migrations/009_*.sql`            | Add `max_sessions` to `api_keys`       |
| `src/lib/db/apiKeys.ts`                      | Include `max_sessions` in key metadata |
| `open-sse/services/sessionManager.ts`        | Track + enforce active session count   |
| `open-sse/chatCore.js`                       | Check limit before session binding     |
| `src/app/(dashboard)/dashboard/api-manager/` | UI field + active session count        |

---

## Acceptance Criteria

- [ ] `max_sessions: 0` allows unlimited sessions (default)
- [ ] `max_sessions: 3` returns 429 on the 4th concurrent session
- [ ] Session count decrements when request closes/finishes
- [ ] API Manager shows `max_sessions` field and active count
- [ ] Existing keys with no `max_sessions` field behave as unlimited
