# T13 · Quota Display Stale After Provider Reset

**Priority:** 🟡 P3 — Display Accuracy
**Effort:** Small (1–2h)
**Phase:** 3 — v3.x

---

## Problem

The Providers dashboard may show cumulative token usage from the previous quota window even after the provider resets (e.g., Codex resets every 5h/7d, Claude has weekly resets). This causes the display to show "500K/1M tokens" even though the window just reset and the actual usage is 0.

sub2api PR #1171 fixes this by comparing the `reset_at` timestamp with `now()` before rendering — if the window has expired, reset the display to 0%.

---

## References

| Source         | Link                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| sub2api commit | `fix: quota display shows stale cumulative usage after daily/weekly reset` (PR #1171) |
| PR #357        | Also related — persist `reset_at` timestamps from `x-codex-*` headers                 |

---

## Implementation Steps

### Step 1 — Store `reset_at` with Usage Data

When persisting quota data (from T03 — Codex headers), always store the corresponding `reset_at`:

```typescript
interface QuotaSnapshot {
  used: number;
  limit: number;
  resetAt: number | null; // epoch ms
  updatedAt: number; // epoch ms — when this snapshot was taken
}
```

### Step 2 — Check Reset Before Display

In the providers dashboard component:

```typescript
function getEffectiveUsage(snapshot: QuotaSnapshot): number {
  if (!snapshot.resetAt) return snapshot.used;
  // If reset time has passed, display shows 0 (window reset)
  if (Date.now() >= snapshot.resetAt) return 0;
  return snapshot.used;
}

// In the UI:
const displayUsage = getEffectiveUsage(codex5hSnapshot);
const displayPercent = snapshot.limit > 0 ? (displayUsage / snapshot.limit) * 100 : 0;
```

### Step 3 — Show "Reset pending" State

If `resetAt` is in the past and we haven't yet received a new snapshot:

- Show 0% usage with a "⟳ Refreshing..." indicator
- Trigger a background probe request to update the snapshot

### Step 4 — Countdown Timer

Display a countdown to the next reset for active windows:

```
[████░░░░░░] 42% — resets in 2h 35m
```

---

## Files to Change

| File                                       | Action                                                    |
| ------------------------------------------ | --------------------------------------------------------- |
| `src/app/(dashboard)/dashboard/providers/` | `getEffectiveUsage()` check before rendering              |
| `src/lib/db/providers.ts`                  | Include `resetAt` in quota snapshot fields                |
| `open-sse/executors/codex.ts`              | Persist `reset_at` from response headers (T03 dependency) |

---

## Acceptance Criteria

- [ ] After a quota window resets, dashboard shows 0% immediately
- [ ] Countdown timer shows time until next reset
- [ ] "⟳ Refreshing..." shown when snapshot is stale post-reset
- [ ] No regression in providers that don't have reset timestamps (show static usage)
