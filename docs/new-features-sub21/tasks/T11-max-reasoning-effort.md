# T11 · Fix `max` Reasoning Effort → `budget_tokens: 100000`

**Priority:** 🟡 P3 — Claude Max Reasoning
**Effort:** Tiny (<30min)
**Phase:** 3 — v3.x

---

## Problem

`reasoning_effort: "max"` from OpenAI clients should map to Anthropic's highest thinking budget (`budget_tokens: 100000`, internally called "xhigh"). Currently `thinkingBudget.ts` likely maps `max` to `high` (32K tokens), losing 68K thinking tokens.

sub2api fixed this in a merged commit: `fix(apicompat): 修正 Anthropic→OpenAI 推理级别映射` and `fix: openai-messages-effort-max-to-xhigh`.

---

## References

| Source         | Link                                                               |
| -------------- | ------------------------------------------------------------------ |
| sub2api fix    | `fix(apicompat): correct Anthropic→OpenAI reasoning level mapping` |
| sub2api fix    | `fix: openai-messages-effort-max-to-xhigh`                         |
| Anthropic max  | `budget_tokens: 100000`                                            |
| OmniRoute file | `open-sse/services/thinkingBudget.ts`                              |

---

## Implementation Steps

### Step 1 — Update `EFFORT_BUDGETS` Map

In `open-sse/services/thinkingBudget.ts`:

```typescript
// Before:
const EFFORT_BUDGETS = { low: 1024, medium: 10240, high: 32000 };

// After:
const EFFORT_BUDGETS = {
  low: 1024,
  medium: 10240,
  high: 32000,
  max: 100000, // ← Claude "xhigh" = 100K tokens
  xhigh: 100000, // ← explicit alias for internal use
};
```

### Step 2 — Reverse Mapping (Anthropic → OpenAI)

When translating Claude's `budget_tokens` back to OpenAI `reasoning_effort`:

```typescript
function budgetToEffort(budget: number): string {
  if (budget >= 100000) return "max"; // ← was missing this
  if (budget >= 32000) return "high";
  if (budget >= 10240) return "medium";
  return "low";
}
```

### Step 3 — Verify `reasoning.effort` field

Also check the `reasoning: { effort: "max" }` form (OpenAI Responses API):

```typescript
const effort = body.reasoning?.effort ?? body.reasoning_effort ?? null;
// "max" must map to 100000
```

---

## Files to Change

| File                                  | Action                                    |
| ------------------------------------- | ----------------------------------------- |
| `open-sse/services/thinkingBudget.ts` | Add `max: 100000` to `EFFORT_BUDGETS`     |
| `open-sse/services/thinkingBudget.ts` | Fix reverse mapping in `budgetToEffort()` |

---

## Acceptance Criteria

- [ ] `reasoning_effort: "max"` sends `budget_tokens: 100000` to Anthropic
- [ ] `reasoning: { effort: "max" }` also maps correctly
- [ ] `budget_tokens: 100000` maps back to `reasoning_effort: "max"` in response
- [ ] Existing `low`/`medium`/`high` behavior unchanged
