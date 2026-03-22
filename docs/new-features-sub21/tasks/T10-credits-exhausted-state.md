# T10 · `credits_exhausted` Distinct Account Status

**Priority:** 🟠 P2 — Account State Visibility
**Effort:** Small (2h)
**Phase:** 2 — Next RC

---

## Problem

When a provider's response indicates the account has exhausted its credits (not a temporary rate limit, but a billing/quota hard stop), OmniRoute currently treats it as a generic error and increments the circuit breaker. This causes:

- Repeated retries on an account that won't succeed until credits are refilled
- Circuit breaker trips unnecessarily
- No visual distinction in the dashboard between "rate limited" and "out of credits"

---

## References

| Source         | Link                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| sub2api commit | `fix: credits-exhausted handling` (PR #1169)                                  |
| Error signals  | `insufficient_quota`, `billing_hard_limit_reached`, `credits exhausted`, etc. |
| Action         | Mark as `credits_exhausted`, skip immediately, show badge                     |

---

## Implementation Steps

### Step 1 — Define Credits Exhaustion Signals

In `src/shared/constants/providers.ts`:

```typescript
export const CREDITS_EXHAUSTED_SIGNALS = [
  // OpenAI
  "insufficient_quota",
  "billing_hard_limit_reached",
  "exceeded your current quota",
  // Anthropic
  "credit_balance_too_low",
  "your credit balance is too low",
  // Generic
  "credits exhausted",
  "quota exceeded",
  "payment required",
  "account balance",
];
```

### Step 2 — Detect in Error Handler

In `open-sse/chatCore.js`:

```js
function isCreditsExhausted(status, body) {
  if (status !== 402 && status !== 429 && status !== 400) return false;
  const bodyLower = (typeof body === "string" ? body : JSON.stringify(body)).toLowerCase();
  return CREDITS_EXHAUSTED_SIGNALS.some((signal) => bodyLower.includes(signal));
}

// In error handling:
if (isCreditsExhausted(status, responseBody)) {
  await updateConnectionStatus(connectionId, "credits_exhausted");
  // Skip this connection, no retry
  skipConnection = true;
}
```

### Step 3 — Distinct Status in DB

In `src/lib/db/providers.ts`, ensure `credits_exhausted` is a valid connection status alongside `active`, `expired`, `error`, `rate_limited`.

### Step 4 — UI Badge

In `src/app/(dashboard)/dashboard/providers/`:

- Show 🟡 amber "Credits Exhausted" badge (distinct from 🔴 "Error" and 🟠 "Rate Limited")
- Badge tooltip: "This account is out of credits. Reload credits on the provider dashboard."
- Allow manual reset to `active` status after user has topped up credits

---

## Files to Change

| File                                       | Action                                          |
| ------------------------------------------ | ----------------------------------------------- |
| `src/shared/constants/providers.ts`        | `CREDITS_EXHAUSTED_SIGNALS` array               |
| `open-sse/chatCore.js`                     | `isCreditsExhausted()` check in error handler   |
| `src/lib/db/providers.ts`                  | Accept `credits_exhausted` as connection status |
| `src/shared/constants/providers.ts`        | Add to `ConnectionStatus` enum/union            |
| `src/app/(dashboard)/dashboard/providers/` | "Credits Exhausted" badge                       |

---

## Acceptance Criteria

- [ ] `402 Payment Required` or `429` with `insufficient_quota` → `credits_exhausted` status
- [ ] Account immediately skipped (no retry, no circuit breaker increment)
- [ ] Dashboard shows amber "Credits Exhausted" badge
- [ ] Manual reset to `active` possible from dashboard
- [ ] Rate-limited (429 without exhaustion signal) still uses circuit breaker normally
