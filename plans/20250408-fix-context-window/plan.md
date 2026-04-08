# Fix Context Window Validation & Enforcement

## Problem Summary

Context window limits (`context_length`) are currently **stored but NOT enforced** in the request pipeline:

1. ✅ `DEFAULT_COMBO_CONTEXT_LENGTH = 200000` - Set correctly
2. ❌ `combo.context_length` - Saved to DB but NEVER used for validation
3. ❌ `compressContext()` - Implemented but NEVER called (dead code)
4. ❌ `sortModelsByContextSize()` - Uses models.dev DB, ignores combo.context_length
5. ❌ No input token validation before sending to provider

## Root Cause

The context window flow is broken:

```
Request → parse body → route → executor.fetch() → Provider
          ↓
     ❌ NO context validation
     ❌ NO compression when oversized
     ❌ NO enforcement of combo.context_length
```

## Solution Overview

### Phase 1: Context Validation Layer

Add input token estimation + validation before request execution

### Phase 2: Context Compression Integration

Wire up existing `compressContext()` function into the pipeline

### Phase 3: Combo Context Length Enforcement

Respect `combo.context_length` in routing decisions

### Phase 4: Provider-Specific Handling

Handle different provider context limit behaviors

---

## Detailed Implementation Plan

### Phase 1: Context Validation Layer

**Priority: HIGH** | **Estimated: 2-3 hours**

#### 1.1 Add Token Estimation Helper

**File:** `open-sse/services/contextManager.ts`

Add `estimateRequestTokens()` function to properly calculate input tokens from request body.

#### 1.2 Add Validation Function

Add `validateContextLimit()` that returns validation result with exceeded amount.

#### 1.3 Integrate into chatCore.ts

**File:** `open-sse/handlers/chatCore.ts`

Call validation BEFORE executing request:

- If oversized → trigger compression
- If still oversized after compression → return 400 error
- Log context validation metrics

### Phase 2: Context Compression Integration

**Priority: HIGH** | **Estimated: 1-2 hours**

#### 2.1 Wire up compressContext()

**File:** `open-sse/handlers/chatCore.ts`

Currently `compressContext()` exists but is never called. Add call site:

```typescript
// After body validation, before translation
const estimatedTokens = estimateRequestTokens(body);
const limit = getEffectiveContextLimit(provider, model, combo);

if (estimatedTokens > limit) {
  log?.warn?.("CONTEXT", `Oversized: ${estimatedTokens} > ${limit}, compressing...`);
  const compressionResult = compressContext(body, {
    provider,
    model,
    maxTokens: limit,
  });

  if (compressionResult.compressed) {
    body = compressionResult.body;
    log?.info?.(
      "CONTEXT",
      `Compressed: ${compressionResult.stats.original} → ${compressionResult.stats.final}`
    );
  }
}
```

### Phase 3: Combo Context Length Enforcement

**Priority: MEDIUM** | **Estimated: 2 hours**

#### 3.1 Pass combo to chatCore

**Files:**

- `src/sse/handlers/chat.ts`
- `open-sse/handlers/chatCore.ts`

Add `combo` parameter to `handleChatCore()` so it can access `combo.context_length`.

#### 3.2 Update getEffectiveContextLimit()

**File:** `open-sse/services/contextManager.ts`

Priority order for context limit:

1. Environment override (`CONTEXT_LENGTH_*`)
2. Combo's `context_length` (if combo request)
3. Model-specific from models.dev DB
4. Provider default from registry
5. Hard-coded defaults

#### 3.3 Update sortModelsByContextSize()

**File:** `open-sse/services/combo.ts`

Currently uses `getModelContextLimit()` which ignores combo settings. Should respect combo's context_length if available.

### Phase 4: Provider-Specific Handling

**Priority: MEDIUM** | **Estimated: 2-3 hours**

#### 4.1 Handle Different Provider Behaviors

Different providers handle context limits differently:

- **Claude**: Returns 400 with specific error message
- **OpenAI**: Returns 400 with "context_length_exceeded"
- **Gemini**: Truncates silently
- **Groq**: Returns 413

Add provider-specific error handling in fallback logic.

#### 4.2 Add Context-Related Metrics

**File:** `open-sse/services/comboMetrics.ts`

Track:

- Context compression frequency per combo
- Average compression ratio
- Requests rejected due to context limit

---

## Files to Modify

| File                                  | Changes                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `open-sse/services/contextManager.ts` | Add `estimateRequestTokens()`, `validateContextLimit()`, `getEffectiveContextLimit()` |
| `open-sse/handlers/chatCore.ts`       | Integrate validation & compression calls                                              |
| `src/sse/handlers/chat.ts`            | Pass combo context to handleChatCore                                                  |
| `open-sse/services/combo.ts`          | Respect combo.context_length in sorting                                               |
| `open-sse/services/comboMetrics.ts`   | Add context-related metrics                                                           |

## Testing Plan

1. **Unit Tests:**
   - `estimateRequestTokens()` accuracy
   - `compressContext()` with various message sizes
   - `validateContextLimit()` edge cases

2. **Integration Tests:**
   - Combo with context_length limit
   - Request that triggers compression
   - Request that exceeds limit even after compression

3. **E2E Tests:**
   - Full request flow with oversized context
   - Verify provider receives compressed context
   - Verify error response when limit exceeded

## Acceptance Criteria

- [ ] `combo.context_length` is respected for combo requests
- [ ] Oversized requests are automatically compressed
- [ ] Requests exceeding limit (even after compression) return clear 400 error
- [ ] Context validation metrics are tracked
- [ ] All existing tests pass
- [ ] New unit tests added for validation logic

## Risks & Mitigations

| Risk                         | Mitigation                                                     |
| ---------------------------- | -------------------------------------------------------------- |
| Token estimation inaccuracy  | Add safety buffer (e.g., 10%) to account for estimation errors |
| Performance impact           | Cache token estimates for identical bodies                     |
| Breaking changes             | Feature-flag compression with env var initially                |
| Provider-specific edge cases | Extensive testing with each provider                           |

## Estimated Timeline

- **Phase 1:** 2-3 hours
- **Phase 2:** 1-2 hours
- **Phase 3:** 2 hours
- **Phase 4:** 2-3 hours
- **Testing & Review:** 2 hours

**Total: 9-12 hours**

## Next Steps

1. Approve this plan
2. Start Phase 1 implementation
3. Run tests after each phase
