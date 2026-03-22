# T06 · `account_deactivated` → Permanent `expired` Status on 401

**Priority:** 🟠 P2 — Account State Correctness
**Effort:** Small (1–2h)
**Phase:** 2 — Next RC

---

## Problem

When an upstream provider returns `401` with `"account_deactivated"` in the response body, OmniRoute currently treats this the same as other 401 errors (expired token → trigger re-auth → retry). This causes:

- Repeated re-auth attempts on a permanently dead account
- Wasted API calls and quota on upstream
- Confusing error messages for users ("failed to refresh token" vs "account is deactivated")

The correct behavior: immediately mark the connection as permanently `expired` and stop retrying.

---

## References

| Source           | Link                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| sub2api PR #1037 | [fix(ratelimit): handle upstream 401 account deactivation](https://github.com/Wei-Shaw/sub2api/pull/1037) |
| Error signal     | `401` body containing `account_deactivated`                                                               |
| Action           | Mark as `expired` permanently, skip retries                                                               |

---

## Implementation Steps

### Step 1 — Define Deactivation Signal Strings

In `src/shared/constants/providers.ts` or a new error constants file:

```typescript
export const ACCOUNT_DEACTIVATED_SIGNALS = [
  "account_deactivated",
  "account_has_been_deactivated",
  "your account has been deactivated",
  "this account has been disabled",
];
```

### Step 2 — Detect in 401 Handler

In `open-sse/chatCore.js` or the generic error handler in each executor:

```typescript
async function handle401Error(connectionId: string, responseBody: string): Promise<void> {
  const isDeactivated = ACCOUNT_DEACTIVATED_SIGNALS.some((signal) =>
    responseBody.toLowerCase().includes(signal)
  );

  if (isDeactivated) {
    // Permanent failure — do NOT retry, do NOT re-auth
    await updateConnectionStatus(connectionId, "expired");
    throw new PermanentAccountError(`Account deactivated: ${connectionId}`);
  }

  // Regular 401 — try token refresh
  await triggerTokenRefresh(connectionId);
}
```

### Step 3 — Stop Retry Loop

Ensure `PermanentAccountError` (or equivalent flag) causes the combo to:

1. Skip this connection for the rest of the request
2. NOT add it back to the retry queue
3. Fall through to the next combo member

### Step 4 — Show Badge in Dashboard

In `src/app/(dashboard)/dashboard/providers/`:

- Show a red "Deactivated" badge for connections with `expired` status that was set due to deactivation (vs normal expiry)
- Add optional tooltip: "Marked as deactivated by upstream. Re-connect to restore."

---

## Files to Change

| File                                       | Action                                   |
| ------------------------------------------ | ---------------------------------------- |
| `src/shared/constants/providers.ts`        | Add `ACCOUNT_DEACTIVATED_SIGNALS` array  |
| `open-sse/chatCore.js`                     | Detect deactivation in 401 handler       |
| `open-sse/executors/codex.ts`              | Apply same check                         |
| `open-sse/executors/claude.ts`             | Apply same check                         |
| `src/lib/db/providers.ts`                  | `updateConnectionStatus("expired")` call |
| `src/app/(dashboard)/dashboard/providers/` | "Deactivated" badge UI                   |

---

## Acceptance Criteria

- [ ] 401 with `account_deactivated` marks connection as `expired` immediately
- [ ] No re-auth attempts are made on deactivated accounts
- [ ] Combo correctly falls through to next member after deactivation
- [ ] Dashboard shows "Deactivated" status badge
- [ ] Normal 401 (expired token) still triggers re-auth correctly
