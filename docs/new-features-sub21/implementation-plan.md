# OmniRoute — Implementation Plan: sub2api Gap Resolution

> Based on gap analysis of [github.com/Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) v0.1.104
> Analysis: merged commits + 38 open PRs (Mar 2026)
> See: [gap-analysis.md](./gap-analysis.md)

---

## Overview

15 actionable improvements identified across routing, billing, translator, and provider layers.
Organized in 3 priority tiers with estimated effort and affected files.

| Priority         | Count | Description                                  |
| ---------------- | ----- | -------------------------------------------- |
| 🔴 P1 — Critical | 4     | Active bugs or significant billing/UX impact |
| 🟠 P2 — Medium   | 6     | Routing correctness, account state handling  |
| 🟡 P3 — Low      | 5     | Pricing, display fixes, minor compat         |

---

## Tier 1 — Critical (P1)

### T01 · `requested_model` in Usage Logs

**Task file:** [tasks/T01-requested-model-log.md](./tasks/T01-requested-model-log.md)

Add a `requested_model` column to the `call_logs` table so we track the model the client asked for separately from the model that was actually routed. Needed for billing transparency and debugging combo fallbacks.

**Affected files:**

- `src/lib/db/migrations/009_requested_model.sql` ← new migration
- `src/lib/db/settings.ts` or `usageDb.ts` ← write requested_model
- `open-sse/chatCore.js` ← capture `body.model` at entry
- `src/app/(dashboard)/dashboard/logs/` ← show new column

---

### T02 · Strip Empty Text Blocks from Nested `tool_result`

**Task file:** [tasks/T02-strip-empty-tool-result-blocks.md](./tasks/T02-strip-empty-tool-result-blocks.md)

Anthropic rejects requests where `tool_result.content` arrays contain `{"type":"text","text":""}`. The fix requires a recursive strip function applied before all Anthropic upstream calls.

**Affected files:**

- `open-sse/translator/openai-to-claude.ts` ← add `stripEmptyTextBlocks()`
- `open-sse/chatCore.js` ← apply before forwarding to Anthropic
- `open-sse/translator/` ← also apply in responses/passthrough paths

---

### T03 · Parse `x-codex-*` Headers for Precise Quota Reset Times

**Task file:** [tasks/T03-codex-quota-reset-headers.md](./tasks/T03-codex-quota-reset-headers.md)

Codex responses include `x-codex-5h-reset-at`, `x-codex-5h-usage`, `x-codex-7d-reset-at`, etc. Parse these after every response to store the exact reset timestamp per window instead of using a 5-minute generic fallback.

**Affected files:**

- `open-sse/executors/codex.ts` ← parse response headers
- `src/lib/db/providers.ts` ← persist `rateLimitResetAt` per connection
- `src/app/(dashboard)/dashboard/providers/` ← display countdown

---

### T04 · `X-Session-Id` Header for External Sticky Routing

**Task file:** [tasks/T04-x-session-id-header.md](./tasks/T04-x-session-id-header.md)

Accept `X-Session-Id` from the client HTTP request and use it as the session key for sticky account routing instead of the internally generated content hash. Required for Nginx users (Nginx drops underscore headers by default — use `underscores_in_headers on`).

**Affected files:**

- `open-sse/chatCore.js` ← read `x-session-id` header
- `open-sse/services/sessionManager.ts` ← accept external session ID
- `docs/` ← document Nginx `underscores_in_headers on` requirement

---

## Tier 2 — Medium (P2)

### T05 · Persist Rate-Limit State in DB to Survive Token Refresh

**Task file:** [tasks/T05-persist-ratelimit-state.md](./tasks/T05-persist-ratelimit-state.md)

Token refresh flows in `codex.ts` and `auth.ts` can accidentally clear in-memory rate-limit state, causing a rate-limited account to be reselected immediately after refresh. Fix by persisting the rate-limit state in the DB and re-checking before account selection.

**Affected files:**

- `src/lib/db/providers.ts` ← add `rate_limit_until` column / read/write
- `open-sse/executors/codex.ts` ← check DB state before returning cached account
- `src/sse/services/auth.ts` ← don't clear rate-limit on credentials-only update

---

### T06 · `account_deactivated` → Permanent `expired` Status

**Task file:** [tasks/T06-account-deactivated-status.md](./tasks/T06-account-deactivated-status.md)

When upstream returns `401` with `account_deactivated` in the body, mark the connection as permanently `expired` instead of entering cooldown. Avoids repeated retries on dead accounts.

**Affected files:**

- `open-sse/chatCore.js` or `open-sse/executors/*.ts` ← detect signal in 401 body
- `src/lib/db/providers.ts` ← `updateConnectionStatus(id, "expired")`
- `src/shared/constants/providers.ts` ← document deactivation error strings

---

### T07 · X-Forwarded-For Validation — Skip Non-IP Entries

**Task file:** [tasks/T07-xff-validation.md](./tasks/T07-xff-validation.md)

When `X-Forwarded-For: unknown, 1.2.3.4` is received, the string `"unknown"` is not a valid IP. Skip invalid entries and fall back to the next valid IP or to remote address.

**Affected files:**

- `open-sse/chatCore.js` ← client IP extraction
- `src/app/api/` middleware ← IP-based rate limiting extraction

---

### T08 · Per-API-Key Session Limit (`max_sessions`)

**Task file:** [tasks/T08-per-key-session-limit.md](./tasks/T08-per-key-session-limit.md)

Add a `max_sessions` field to API keys (default 0 = unlimited). When a key exceeds the configured number of concurrent sessions, return HTTP 429 with a friendly message. Configurable in API Manager dashboard.

**Affected files:**

- `src/lib/db/apiKeys.ts` ← add `max_sessions` field
- `src/lib/db/migrations/009_*` ← (can bundle with T01 migration)
- `open-sse/services/sessionManager.ts` ← enforce session count
- `src/app/(dashboard)/dashboard/api-manager/` ← UI field

---

### T09 · Codex vs Codex Spark Separate Rate Limit Scopes

**Task file:** [tasks/T09-codex-spark-rate-limit-scope.md](./tasks/T09-codex-spark-rate-limit-scope.md)

Codex has two rate-limit scopes: `codex` (standard) and `spark` (premium). When `codex` quota is exhausted, `spark` quota may still be available. Track these separately to avoid blocking the entire account when only one scope is exhausted.

**Affected files:**

- `open-sse/executors/codex.ts` ← scope-aware rate limit tracking
- `open-sse/services/rateLimitSemaphore.ts` ← key by `{accountId}:{scope}`
- `src/lib/db/providers.ts` ← persist per-scope state

---

### T10 · `credits_exhausted` Distinct Account Status

**Task file:** [tasks/T10-credits-exhausted-state.md](./tasks/T10-credits-exhausted-state.md)

When a provider returns signals like `insufficient_quota`, `billing_hard_limit_reached`, or `credits exhausted`, mark the connection as `credits_exhausted` (distinct from `error` or `rate_limited`) and skip it immediately without retry.

**Affected files:**

- `open-sse/chatCore.js` ← detect exhaustion signals in response body
- `src/lib/db/providers.ts` ← new status value + UI badge
- `src/app/(dashboard)/dashboard/providers/` ← display badge

---

## Tier 3 — Low (P3)

### T11 · Fix `max` Reasoning Effort → `budget_tokens: 100000`

**Task file:** [tasks/T11-max-reasoning-effort.md](./tasks/T11-max-reasoning-effort.md)

`reasoning_effort: "max"` should map to `budget_tokens: 100000` (Claude's "xhigh" level), not `high` (32K).

**Affected files:**

- `open-sse/services/thinkingBudget.ts` ← add `max: 100000` to EFFORT_BUDGETS

---

### T12 · Model Pricing Updates

**Task file:** [tasks/T12-model-pricing-updates.md](./tasks/T12-model-pricing-updates.md)

Add missing pricing entries: MiniMax M2.5 ($0.27/$0.95), MiniMax M2.7 (TBD), GLM-4.7 ($0.38/$1.98), GLM-5, Kimi, gpt-5.4 mini.

**Affected files:**

- `open-sse/config/providerRegistry.ts` ← add new model entries with pricing
- `src/lib/db/settings.ts` ← default pricing table

---

### T13 · Quota Display Stale After Reset

**Task file:** [tasks/T13-stale-quota-display.md](./tasks/T13-stale-quota-display.md)

Dashboard shows stale cumulative usage after the upstream provider resets quota windows. Fix by comparing `reset_at` timestamps before displaying counters.

**Affected files:**

- `src/app/(dashboard)/dashboard/providers/` ← check `resetAt` before rendering
- `src/lib/db/providers.ts` ← expose `rateLimitResetAt` in provider data

---

### T14 · Proxy Fast-Fail on Dead Proxy

**Task file:** [tasks/T14-proxy-fast-fail.md](./tasks/T14-proxy-fast-fail.md)

When a configured proxy is unreachable, fail immediately (2s TCP check) instead of waiting 30s per request.

**Affected files:**

- `src/lib/apiBridgeServer.ts` ← add proxy health cache + TCP check
- `open-sse/chatCore.js` or `src/lib/proxyAgent.ts` ← gate requests through health check

---

### T15 · Array Content in System/Tool Messages

**Task file:** [tasks/T15-array-content-messages.md](./tasks/T15-array-content-messages.md)

Some SDKs send `content: [{type:"text", text:"..."}]` (array) for system and tool messages instead of `content: "string"`. Both forms must be handled in the translator.

**Affected files:**

- `open-sse/translator/openai-to-claude.ts` ← normalize content field
- `open-sse/chatCore.js` ← normalize before dispatch

---

## Implementation Order

```
Phase 1 (now, this branch): T01, T02, T03, T04      ← P1 bugs + billing
Phase 2 (next RC):          T05, T06, T07, T09, T10 ← account state correctness
Phase 3 (v3.x):             T08, T11, T12, T13, T14, T15 ← polish + pricing
```

---

## References

- [sub2api GitHub](https://github.com/Wei-Shaw/sub2api)
- [gap-analysis.md](./gap-analysis.md) — full analysis with PR references
- [sub2api PR list](https://github.com/Wei-Shaw/sub2api/pulls)
