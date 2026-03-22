# sub2api vs OmniRoute — Gap Analysis v2 (with Open PRs)

> **Source:** [github.com/Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) · v0.1.104 · 87 contributors · 92 releases
> **Analyzed:** merged commits (Mar 20-21, 2026) + **38 open PRs** (pages 1 & 2)
> **Date:** 2026-03-22

---

## ✅ Already Covered by OmniRoute (no gap)

| Feature                          | OmniRoute                                               |
| -------------------------------- | ------------------------------------------------------- |
| Sticky session routing           | `sessionManager.ts` + `stickyRoundRobinLimit`           |
| Per-model concurrency limiter    | `rateLimitSemaphore.ts` (FIFO queue)                    |
| `reasoning_effort` bidirectional | `thinkingBudget.ts` (low/medium/high ↔ `budget_tokens`) |
| Thinking block support           | `claude-to-openai.ts` state machine                     |
| Circuit breaker                  | Per-model, exponential backoff                          |
| OAuth token auto-refresh         | 18 providers                                            |
| Request dedup                    | 5s content-hash window                                  |
| Rate limit detection             | Per-provider RPM, min gap, max concurrent               |

---

## 🚨 Priority 1 — High Impact, Actionable Now

### 1. `requested_model` vs `routed_model` in Usage Logs

**Source:** 8 merged commits (Mar 19-20) — `feat(ent): add requested model to usage log schema` through `fix(dto): fallback to legacy model in usage mapping`

When a user asks for `openai/gpt-5.2-codex` but the combo falls back to `gpt-5.2-mini`, today's usage log stores only the routed model. sub2api now stores both.

**Gap:** OmniRoute `call_logs` has a single `model` field. Users can't audit requested vs actual.

```sql
-- Migration 009
ALTER TABLE call_logs ADD COLUMN requested_model TEXT DEFAULT NULL;
```

- Capture `body.model` at entry as `requestedModel`; store resolved model in existing field
- Show both in Logs dashboard and Analytics filters

**Priority:** 🔴 Billing transparency / user trust

---

### 2. Empty Text Blocks in Nested `tool_result` → 400 Error

**Source:** Open PR [#1212](https://github.com/Wei-Shaw/sub2api/pull/1212) — `fix(gateway): strip empty text blocks nested in tool_result.content`

Anthropic returns `400: "messages: text content blocks must be non-empty"` when a `tool_result.content` array contains `{"type":"text","text":""}`. The fix in PR #1212 is:

- Add `stripEmptyTextBlocksFromSlice()` that **recursively** filters nested content arrays
- Apply pre-filter on ALL upstream Anthropic paths (gateway, passthrough, count_tokens)

**OmniRoute gap:** Our `openai-to-claude.ts` translator likely has the same bug — Claude Code in extended tool chains triggers this regularly.

```typescript
// In openai-to-claude.ts or claude translator
function stripEmptyTextBlocks(content: ContentBlock[]): ContentBlock[] {
  return content
    .filter((b) => !(b.type === "text" && b.text === ""))
    .map((b) =>
      b.type === "tool_result" && Array.isArray(b.content)
        ? { ...b, content: stripEmptyTextBlocks(b.content) } // recurse
        : b
    );
}
```

**Priority:** 🔴 Active 400 errors for users with tool-heavy agents

---

### 3. `x-codex-*` Header Parsing for Precise Quota Reset Times

**Source:** Open PR [#357](https://github.com/Wei-Shaw/sub2api/pull/357) — `feat(oauth): persist usage snapshots and window cooldown`

Codex responses include headers: `x-codex-5h-usage`, `x-codex-5h-limit`, `x-codex-5h-reset-at`, `x-codex-7d-usage`, `x-codex-7d-limit`, `x-codex-7d-reset-at`.

Today sub2api uses a generic 5-minute fallback when hitting a 429. The PR makes it:

- Parse these headers after every Codex request
- Persist exact `reset_at` per window (5h / 7d)
- Block the account until that exact timestamp (not a flat 5min guess)
- Also run an optional periodic `OAuthProbeService` for idle accounts

**OmniRoute gap:** Our `codex.ts` executor parses some quota headers but likely falls back to circuit-breaker cooldown, not precise reset time.

```typescript
// In codex.ts after each response
const resetAt5h = response.headers.get("x-codex-5h-reset-at");
const resetAt7d = response.headers.get("x-codex-7d-reset-at");
const usagePercent =
  parseFloat(response.headers.get("x-codex-5h-usage") ?? "0") /
  parseFloat(response.headers.get("x-codex-5h-limit") ?? "1");

if (usagePercent >= 1 && resetAt5h) {
  // block this connection until resetAt (not just 5min)
  connection.rateLimitResetAt = new Date(resetAt5h).getTime();
}
```

**Priority:** 🔴 Codex is a top-used provider — bad reset timing hurts UX significantly

---

### 4. `X-Session-Id` HTTP Header for External Sticky Session

**Source:** sub2api README Nginx note: `underscores_in_headers on` required for `session_id` header

Clients send `X-Session-Id: abc123` to pin the conversation to the same account. Critical for:

- Nginx reverse proxy users (Nginx drops underscore headers by default)
- Claude Code / Codex sessions that break on mid-conversation account switches

**OmniRoute gap:** Our `sessionManager.ts` generates sessions internally (content hash). No way for the client to set a session ID.

```typescript
// In chatCore.js request handler
const clientSessionId = req.headers["x-session-id"] ?? req.headers["session-id"];
const sessionId = clientSessionId ? `client:${clientSessionId}` : generateSessionHash(body);
```

**Priority:** 🔴 Nginx users lose sticky routing

---

## 🟠 Priority 2 — Medium Impact

### 5. Rate-Limited Accounts Not Rescheduled After Token Refresh

**Source:** Open PR [#1218](https://github.com/Wei-Shaw/sub2api/pull/1218) — `fix(openai): prevent rescheduling rate-limited accounts`

When token refresh runs, it can accidentally clear the `rate_limited` state cached in memory, causing a rate-limited account to be selected again immediately.

**OmniRoute gap:** Our circuit breaker state is in-memory. A token refresh in `codex.ts` or `auth.ts` could reset the flag. Need to persist account-level rate-limit state in DB (not just in-memory circuit breaker).

**Priority:** 🟠 Codex users hitting rate limits loop repeatedly

---

### 6. Per-User Session Limit (`max_sessions`)

**Source:** Open PR [#634](https://github.com/Wei-Shaw/sub2api/pull/634) — `fix: stabilize session hash + add user-level session limit`

PR adds a `max_sessions` field per user (default 0 = unlimited). When a user opens more than N concurrent sessions, the gateway returns:

> HTTP 429: "You have reached the maximum number of active sessions. Please close unused sessions or wait."

Also fixes session hash stability: previously using message content as seed caused same user to appear as multiple sessions across turns. Now uses `ClientIP + APIKeyID`.

**OmniRoute gap:** No per-key session limit. A single API key can open unlimited sticky sessions. Session hash may be similarly unstable across turns.

**Priority:** 🟠 Relevant for shared deployments / API key abuse prevention

---

### 7. Codex vs Codex Spark — Separate Rate Limit Scopes

**Source:** Open PR [#1129](https://github.com/Wei-Shaw/sub2api/pull/1129) — `feat(openai): split codex spark rate limiting from codex`

Codex has two model tiers: `codex` (standard) and `spark` (more powerful/limited). Today, when `codex` hits its quota, the whole account gets marked rate-limited — even though `spark` quota might still be available.

**OmniRoute gap:** Our circuit breaker is per-model-alias, so this may partly be handled. But check that hitting `codex` quota doesn't block `codex:spark` or `gpt-5.2-codex` models.

**Priority:** 🟠 Codex quota management

---

### 8. 401 `account_deactivated` — Distinct Account State

**Source:** Open PR [#1037](https://github.com/Wei-Shaw/sub2api/pull/1037) — `fix(ratelimit): handle upstream 401 account deactivation`

When upstream returns 401 with body containing `account_deactivated`, the account should be immediately marked as permanently deactivated — not put in rate-limit cooldown to retry in 5 minutes.

**OmniRoute gap:** Our auth error handling in executors treats most 401s as token-expired (triggers re-auth). A `account_deactivated` 401 should mark the connection as `expired` permanently.

```typescript
// In executor error handler
if (status === 401 && body.includes("account_deactivated")) {
  await markConnectionStatus(connectionId, "expired");
  throw new PermanentAccountError("Account deactivated by upstream");
}
```

**Priority:** 🟠 Avoids wasted retries on dead accounts

---

### 9. OpenAI-Compatible Chat Completions Mode (Alibaba Coding Plan etc.)

**Source:** Open PR [#1216](https://github.com/Wei-Shaw/sub2api/pull/1216) — `feat: add support for OpenAI-compatible providers using Chat Completions API`

Some OpenAI-compatible providers (Alibaba Coding Plan: `coding-intl.dashscope.aliyuncs.com`) support `/v1/chat/completions` but NOT the `/v1/responses` (Responses API). Sub2API adds a per-account flag `openai_chat_completions_mode: true` to skip Responses API and use Chat Completions directly.

**OmniRoute gap:** We already have separate executors but any OpenAI-Responses API executor that falls back to `/chat/completions` should be configurable per-connection. Check `responsesHandler.js` for providers that don't support Responses.

**Priority:** 🟠 Compatibility with more OpenAI-compat providers

---

### 10. `X-Forwarded-For` — Skip Invalid Entries for Client IP

**Source:** Open PR [#1135](https://github.com/Wei-Shaw/sub2api/pull/1135) — `fix: skip invalid X-Forwarded-For entries in client IP detection`

When `X-Forwarded-For` contains `unknown, 1.2.3.4`, the string `"unknown"` is not a valid IP and should be skipped, falling back to the next entry or to `ClientIP()`.

**OmniRoute gap:** Our IP extraction for rate limiting — check if we're validating each entry before trusting the first one.

**Priority:** 🟠 IP-based rate limiting correctness behind proxies

---

## 🟡 Priority 3 — Low-Medium Impact

### 11. `credits_exhausted` as Distinct Account State

**Source:** Merged commit `fix: credits-exhausted handling` (PR #1169)

**Gap:** Distinguish "credits exhausted" from generic error. Set account to `credits_exhausted` state immediately. **Already covered above** in v1 analysis — repeating for completeness.

---

### 12. Model Pricing Updates — Missing from OmniRoute Pricing Table

**Source:** Open PR [#970](https://github.com/Wei-Shaw/sub2api/pull/970), closed commit `fix: format gpt-5.4 mini fallback pricing`

Models and pricing sub2api tracks that OmniRoute may be missing:

| Model                                     | Input $/MTok | Output $/MTok |
| ----------------------------------------- | ------------ | ------------- |
| **MiniMax M2.5**                          | $0.27        | $0.95         |
| **MiniMax M2.7** (PR #1120 — new default) | TBD          | TBD           |
| **GLM-4.7** (Zhipu)                       | $0.38        | $1.98         |
| **GLM-5** (Zhipu)                         | ~$0.38       | ~$1.98        |
| **Kimi** (Moonshot)                       | (see PR)     | (see PR)      |
| **gpt-5.4 mini**                          | (see commit) | (see commit)  |

**Action:** Add/verify these in OmniRoute's pricing settings and model registry.

---

### 13. `max` Reasoning Effort → `budget_tokens: 100000` (xhigh)

**Source:** Merged commit `fix(apicompat): 修正 Anthropic→OpenAI 推理级别映射` + PR `fix: openai-messages-effort-max-to-xhigh`

**Gap:** In `thinkingBudget.ts`, `reasoning_effort: "max"` probably maps to `high` (32K tokens). The correct value is 100K:

```typescript
const EFFORT_BUDGETS = { low: 1024, medium: 10240, high: 32000, max: 100000 };
```

---

### 14. Usage Snapshots Stale After Reset

**Source:** Merged commit `fix: quota display shows stale cumulative usage after daily/weekly reset` (PR #1171)

Dashboard can show stale cumulative usage after the upstream quota window resets. Fix: compare `reset_at` with `now()` before displaying counters; auto-zero if window has passed.

---

### 15. Proxy Fast-Fail on Dead Proxy

**Source:** Merged commit `fix: proxy-fast-fail` (PR #1167)

When configured proxy is down, requests hang for full timeout (30s). Quick TCP health check before request can short-circuit failures in 2s.

---

## 💡 Architectural Items to Watch (Future)

| PR                                                     | Feature                                                                      | Relevance                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [#1010](https://github.com/Wei-Shaw/sub2api/pull/1010) | **OIDC login** — generic OIDC OAuth login + IdP real email                   | Relevant if OmniRoute adds multi-user login (SSO enterprise integrations) |
| [#977](https://github.com/Wei-Shaw/sub2api/pull/977)   | **Webhook custom headers** — custom request headers on webhook notifications | Relevant if OmniRoute adds webhook alerts                                 |
| [#976](https://github.com/Wei-Shaw/sub2api/pull/976)   | **Scheduled webhook failure test** — scheduled webhook health self-test      | Same                                                                      |
| [#734](https://github.com/Wei-Shaw/sub2api/pull/734)   | **User invite/referral system** — viral growth for SaaS                      | Future, if OmniRoute goes SaaS                                            |
| [#618](https://github.com/Wei-Shaw/sub2api/pull/618)   | **LDAP auth** — enterprise directory login                                   | Future enterprise                                                         |
| [#487](https://github.com/Wei-Shaw/sub2api/pull/487)   | **Balance management page** — admin credit top-up UI                         | Future SaaS                                                               |
| [#1012](https://github.com/Wei-Shaw/sub2api/pull/1012) | **Subscription benefit plan** — tiered plan benefits management              | Future SaaS                                                               |
| [#945](https://github.com/Wei-Shaw/sub2api/pull/945)   | **Gemini native embeddings** — direct Gemini embedding endpoint              | Already in OmniRoute                                                      |

---

## 📋 Final Prioritized Action List

| #   | Action                                                                                | From            | Effort | Priority |
| --- | ------------------------------------------------------------------------------------- | --------------- | ------ | -------- |
| 1   | `requested_model` column in call_logs (migration 009)                                 | Merged commits  | Medium | 🔴 P1    |
| 2   | Strip empty text blocks from nested `tool_result.content` before forwarding to Claude | PR #1212        | Small  | 🔴 P1    |
| 3   | Parse `x-codex-*` headers for precise 5h/7d reset times (not 5min fallback)           | PR #357         | Medium | 🔴 P1    |
| 4   | `X-Session-Id` header → external sticky routing                                       | README note     | Small  | 🔴 P1    |
| 5   | Persist rate-limit state in DB so token refresh doesn't clear it                      | PR #1218        | Medium | 🟠 P2    |
| 6   | `account_deactivated` → permanent `expired` status, not cooldown                      | PR #1037        | Small  | 🟠 P2    |
| 7   | `X-Forwarded-For` validation — skip non-IP entries                                    | PR #1135        | Tiny   | 🟠 P2    |
| 8   | Per-API-key session limit (`max_sessions`)                                            | PR #634         | Medium | 🟠 P2    |
| 9   | Codex vs Spark separate rate limit scopes                                             | PR #1129        | Small  | 🟠 P2    |
| 10  | `credits_exhausted` distinct account status                                           | PR #1169        | Small  | 🟠 P2    |
| 11  | `max` reasoning_effort → `budget_tokens: 100000`                                      | Merged commit   | Tiny   | 🟡 P3    |
| 12  | Model pricing: MiniMax M2.5/M2.7, GLM-4.7/5, Kimi, gpt-5.4 mini                       | PR #970, commit | Tiny   | 🟡 P3    |
| 13  | Quota display stale-after-reset fix                                                   | PR #1171        | Small  | 🟡 P3    |
| 14  | Proxy fast-fail (2s TCP check before hanging 30s)                                     | PR #1167        | Small  | 🟡 P3    |
| 15  | Array content in system/tool messages (`content: [{type:"text"}]`)                    | PR #1197        | Tiny   | 🟡 P3    |
