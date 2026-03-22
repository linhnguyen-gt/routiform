# T01 · `requested_model` in Usage Logs

**Priority:** 🔴 P1 — Billing Transparency
**Effort:** Medium (2–4h)
**Phase:** 1 — Current branch

---

## Problem

When a user sends `model: openai/gpt-5.2-codex` but OmniRoute falls back to `gpt-5.2-mini` via combo, the `call_logs` today only stores the routed model. Users and admins cannot audit:

- What model was requested vs what was actually used
- Which requests triggered fallbacks
- Whether billing reflects actual upstream usage

sub2api dedicated 8 commits (Mar 19-20, 2026) to solving this across schema, DB, gateway, DTO, and billing layers.

---

## References

| Source                     | Link                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| sub2api PR feat (schema)   | [feat(ent): add requested model to usage log schema](https://github.com/Wei-Shaw/sub2api/commit/0b845c2532198b392685aae0129b23518a106d8d)            |
| sub2api PR feat (billing)  | [fix(usage): preserve requested model in gateway billing paths](https://github.com/Wei-Shaw/sub2api/commit/4edcfe1f7ce50cfc7ac4d1257282b8448bd60d15) |
| sub2api PR fix (DTO)       | [fix(dto): fallback to legacy model in usage mapping](https://github.com/Wei-Shaw/sub2api/commit/27948c777e4dfef2e3117a0f74cf59d433a0b524)           |
| sub2api PR fix (Gemini/WS) | [fix(provider): retain upstream model for gemini compat and ws](https://github.com/Wei-Shaw/sub2api/commit/2c667a159cf5eae1d030590cf1afc48f90d9c304) |

---

## Implementation Steps

### Step 1 — DB Migration

Create `src/lib/db/migrations/009_requested_model.sql`:

```sql
-- Migration 009: add requested_model to call_logs for billing transparency
ALTER TABLE call_logs ADD COLUMN requested_model TEXT DEFAULT NULL;

-- Index to allow filtering by requested model in Analytics
CREATE INDEX IF NOT EXISTS idx_call_logs_requested_model
  ON call_logs(requested_model);
```

### Step 2 — Capture `requested_model` at Request Entry

In `open-sse/chatCore.js`, at the very start of request handling, before any combo/routing logic:

```js
// At the top of handleChatRequest()
const requestedModel = body.model ?? null;

// Pass through to usage logging
const usageContext = {
  requestedModel,
  // ... existing fields
};
```

### Step 3 — Write to DB on Completion

In `src/lib/usageDb.ts` or wherever `call_logs` is written:

```typescript
await db.run(`
  INSERT INTO call_logs (model, requested_model, ...)
  VALUES (?, ?, ...)
`, [routedModel, requestedModel, ...]);
```

### Step 4 — Expose in Logs Dashboard

In `src/app/(dashboard)/dashboard/logs/`:

- Add `requested_model` column to request logs table (collapsible, off by default)
- Show pill badge if `requested_model !== model` (fallback occurred)
- Add filter by `requested_model`

### Step 5 — Analytics

In usage analytics, add breakdown:

- "Fallback rate" = requests where `requested_model !== model` / total
- Group by `requested_model` to see most-requested models

---

## Files to Change

| File                                            | Action                              |
| ----------------------------------------------- | ----------------------------------- |
| `src/lib/db/migrations/009_requested_model.sql` | NEW — migration                     |
| `src/lib/db/core.ts`                            | Auto-applies migration on startup   |
| `open-sse/chatCore.js`                          | Capture `body.model` before routing |
| `src/lib/usageDb.ts`                            | Write `requested_model` field       |
| `src/app/(dashboard)/dashboard/logs/`           | Show in table + filter              |
| `src/app/(dashboard)/dashboard/analytics/`      | Fallback rate metric                |

---

## Acceptance Criteria

- [ ] `call_logs.requested_model` column exists after migration
- [ ] When combo falls back, `requested_model` differs from `model` in logs
- [ ] Logs page shows `requested_model` column
- [ ] Analytics shows fallback rate stat card
- [ ] No regression in existing log writes (field is nullable)
