# T12 · Model Pricing Updates (MiniMax, GLM, Kimi, gpt-5.4 mini)

**Priority:** 🟡 P3 — Catalog Completeness
**Effort:** Tiny (<1h)
**Phase:** 3 — v3.x

---

## Problem

Several newer models used by our providers are either missing from OmniRoute's pricing table or have incorrect/outdated pricing. Without accurate pricing, cost analytics are wrong for these models.

---

## References

| Source           | Link                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| sub2api PR #970  | [feat(billing): add fallback pricing for MiniMax M2.5, GLM-4.7/5, Kimi](https://github.com/Wei-Shaw/sub2api/pull/970) |
| sub2api PR #1120 | [feat: upgrade MiniMax default model to M2.7](https://github.com/Wei-Shaw/sub2api/pull/1120)                          |
| sub2api commit   | `fix: format gpt-5.4 mini fallback pricing`                                                                           |

---

## Pricing Data from sub2api

| Model                    | Input $/MTok | Output $/MTok | Notes                         |
| ------------------------ | ------------ | ------------- | ----------------------------- |
| `MiniMax-M2.5`           | $0.27        | $0.95         | via `api.minimax.io`          |
| `MiniMax-M2.7`           | TBD          | TBD           | New default, `api.minimax.io` |
| `MiniMax-M2.7-highspeed` | TBD          | TBD           |                               |
| `GLM-4.7` (Zhipu)        | $0.38        | $1.98         |                               |
| `GLM-5` (Zhipu)          | ~$0.38       | ~$1.98        | Check official page           |
| `Kimi` (Moonshot)        | TBD          | TBD           | Check moonshot.cn             |
| `gpt-5.4`                | TBD          | TBD           |                               |
| `gpt-5.4-mini`           | TBD          | TBD           | Check openai.com/pricing      |

---

## Implementation Steps

### Step 1 — Verify Current Pricing Table

Check `open-sse/config/providerRegistry.ts` for existing entries:

```bash
grep -n "minimax\|glm\|kimi\|gpt-5.4" open-sse/config/providerRegistry.ts
```

### Step 2 — Add Missing Models to Provider Registry

```typescript
// In providerRegistry.ts, minimax section:
{ id: "minimax-m2.5", label: "MiniMax M2.5", inputPrice: 0.27, outputPrice: 0.95 },
{ id: "minimax-m2.7", label: "MiniMax M2.7", inputPrice: TBD, outputPrice: TBD },

// GLM section:
{ id: "glm-4.7", label: "GLM-4.7", inputPrice: 0.38, outputPrice: 1.98 },
{ id: "glm-5", label: "GLM-5", inputPrice: 0.38, outputPrice: 1.98 },
```

### Step 3 — Verify Official Pricing Sources

Before committing, verify against official sources:

- MiniMax: https://platform.minimaxi.com/document/Price
- Zhipu GLM: https://open.bigmodel.cn/pricing
- Moonshot Kimi: https://platform.moonshot.cn/docs/pricing
- OpenAI gpt-5.4: https://openai.com/api/pricing

### Step 4 — Update Default Model for MiniMax

If OmniRoute has a "default model" for MiniMax, update to M2.7 (sub2api PR #1120).
New endpoint URL: `api.minimax.io` (update allowlist).

---

## Files to Change

| File                                  | Action                                     |
| ------------------------------------- | ------------------------------------------ |
| `open-sse/config/providerRegistry.ts` | Add/update model entries                   |
| `src/lib/db/settings.ts`              | Default pricing table entries              |
| `src/shared/constants/providers.ts`   | Update MiniMax default model if applicable |

---

## Acceptance Criteria

- [ ] MiniMax M2.5 and M2.7 have pricing entries
- [ ] GLM-4.7 and GLM-5 have pricing entries
- [ ] gpt-5.4 / gpt-5.4-mini have pricing entries
- [ ] Kimi models have pricing entries
- [ ] Pricing verified against official sources before merging
- [ ] Cost analytics shows correct estimates for these models
