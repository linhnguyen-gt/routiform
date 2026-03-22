# T09 · Codex vs Codex Spark — Separate Rate Limit Scopes

**Priority:** 🟠 P2 — Codex Quota Efficiency
**Effort:** Small (2h)
**Phase:** 2 — Next RC

---

## Problem

OpenAI Codex has two model tiers within the same account:

- `codex` — standard (gpt-5.2-codex, etc.)
- `spark` — premium/more capable (codex-spark models)

Each tier has its own independent quota. When the `codex` tier exhausts its quota, the whole account gets circuit-breakered — even though the `spark` tier may still have quota available (or vice versa).

sub2api PR #1129 fixes this by splitting rate-limit state into two scopes and only blocking the account globally when ALL scopes are exhausted.

---

## References

| Source           | Link                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| sub2api PR #1129 | [feat(openai): split codex spark rate limiting from codex](https://github.com/Wei-Shaw/sub2api/pull/1129) |
| Problem          | Exhausting `codex` quota blocks `spark` unnecessarily                                                     |
| Fix              | Scope-aware rate limit tracking per model family                                                          |

---

## Implementation Steps

### Step 1 — Define Codex Scopes

In `open-sse/executors/codex.ts`:

```typescript
const CODEX_SCOPE_PATTERNS: Record<string, string> = {
  // model name pattern → rate limit scope
  "gpt-5.2-codex": "codex",
  "codex-spark": "spark",
  "codex-mini": "codex",
  // default (anything else): "codex"
};

function getModelScope(model: string): "codex" | "spark" {
  for (const [pattern, scope] of Object.entries(CODEX_SCOPE_PATTERNS)) {
    if (model.includes(pattern)) return scope as "codex" | "spark";
  }
  return "codex"; // default scope
}
```

### Step 2 — Scope-keyed Rate Limit State

In `open-sse/services/rateLimitSemaphore.ts`, change the key from `{accountId}` to `{accountId}:{scope}`:

```typescript
// Before: rateLimitState.get(accountId)
// After:
const scopeKey = `${accountId}:${scope}`;
rateLimitState.get(scopeKey);
```

### Step 3 — Persist Per-Scope State

In `src/lib/db/providers.ts`, store scope-aware rate limits in connection extras:

```typescript
// In connection extra JSON:
{
  "rate_limited": {
    "codex": { "until": 1234567890 },
    "spark": null
  }
}
```

### Step 4 — Only Block Account When ALL Scopes Exhausted

In account selection logic:

```typescript
function isAccountFullyRateLimited(connection: Connection, requestedScope: string): boolean {
  const scopeState = connection.extra?.rate_limited?.[requestedScope];
  if (!scopeState?.until) return false;
  return Date.now() < scopeState.until;
}
// Only skip account if the REQUESTED scope is rate-limited
```

### Step 5 — Clear Scope on Reset

When the reset timer fires for one scope, clear only that scope — not all scopes.

---

## Files to Change

| File                                      | Action                                      |
| ----------------------------------------- | ------------------------------------------- |
| `open-sse/executors/codex.ts`             | `getModelScope()`, scope-aware 429 handling |
| `open-sse/services/rateLimitSemaphore.ts` | Scope-suffixed rate limit keys              |
| `src/lib/db/providers.ts`                 | Per-scope state in connection extras        |
| `src/sse/services/auth.ts`                | Check scope before skipping account         |

---

## Acceptance Criteria

- [ ] `codex` quota exhaustion does NOT block requests to `spark` models
- [ ] `spark` quota exhaustion does NOT block requests to `codex` models
- [ ] Both scopes exhausted → account fully skipped
- [ ] Scope state persists in DB (survives token refresh)
- [ ] Dashboard shows per-scope quota status
