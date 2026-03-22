# T02 · Strip Empty Text Blocks from Nested `tool_result`

**Priority:** 🔴 P1 — Active 400 Errors
**Effort:** Small (1–2h)
**Phase:** 1 — Current branch

---

## Problem

Anthropic rejects requests where a `tool_result.content` array contains blocks with empty text:

```json
{ "type": "tool_result", "content": [{ "type": "text", "text": "" }] }
```

Returns: **400** `messages: text content blocks must be non-empty`

This is especially common with Claude Code and Codex in long tool-call chains where intermediate reasoning steps produce empty text blocks that get carried into subsequent requests.

The fix requires **recursive** filtering — not just top-level, but also inside nested `tool_result.content` arrays.

---

## References

| Source           | Link                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| sub2api PR #1212 | [fix(gateway): strip empty text blocks in nested tool_result.content](https://github.com/Wei-Shaw/sub2api/pull/1212) |
| Anthropic error  | `messages: text content blocks must be non-empty`                                                                    |
| PR detail        | Adds `stripEmptyTextBlocksFromSlice()` recursive helper                                                              |

---

## Implementation Steps

### Step 1 — Add `stripEmptyTextBlocks()` utility

In `open-sse/translator/openai-to-claude.ts` (or a shared `utils.ts`):

```typescript
/**
 * Recursively strips empty text blocks from content arrays.
 * Anthropic returns 400 if any text block has text: "".
 * Must handle nesting inside tool_result.content arrays.
 */
export function stripEmptyTextBlocks(content: ContentBlock[] | undefined): ContentBlock[] {
  if (!content) return [];
  return content
    .filter((block) => {
      // Remove top-level empty text blocks
      if (block.type === "text" && (!block.text || block.text === "")) return false;
      return true;
    })
    .map((block) => {
      // Recurse into tool_result.content
      if (block.type === "tool_result" && Array.isArray(block.content)) {
        return { ...block, content: stripEmptyTextBlocks(block.content) };
      }
      return block;
    });
}
```

### Step 2 — Apply Before ALL Anthropic Upstream Calls

Apply `stripEmptyTextBlocks()` on each message's content in the request body before forwarding:

```typescript
// In openai-to-claude translator, before building anthropic body
const sanitizedMessages = messages.map((msg) => ({
  ...msg,
  content: Array.isArray(msg.content) ? stripEmptyTextBlocks(msg.content) : msg.content,
}));
```

Apply in ALL paths sending to Anthropic:

- `open-sse/chatCore.js` main handler
- `open-sse/responsesHandler.js` (Responses API path)
- Any passthrough / count_tokens path

### Step 3 — Unit Tests

Add test cases:

```typescript
describe("stripEmptyTextBlocks", () => {
  it("removes top-level empty text blocks", ...);
  it("recurses into tool_result.content", ...);
  it("handles deeply nested tool_result", ...);
  it("preserves non-empty text blocks", ...);
  it("is a no-op when no empty blocks", ...);
});
```

---

## Files to Change

| File                                      | Action                                |
| ----------------------------------------- | ------------------------------------- |
| `open-sse/translator/openai-to-claude.ts` | Add `stripEmptyTextBlocks()` function |
| `open-sse/chatCore.js`                    | Apply before Anthropic forwarding     |
| `open-sse/responsesHandler.js`            | Apply before Anthropic forwarding     |
| `open-sse/tests/`                         | Unit tests for new function           |

---

## Acceptance Criteria

- [ ] Empty text blocks at top level are stripped
- [ ] Empty text blocks inside `tool_result.content` are stripped
- [ ] Multi-level nesting is handled recursively
- [ ] No existing non-empty text blocks are modified
- [ ] All existing tests continue to pass
- [ ] Claude Code + tool-heavy scenarios no longer produce 400
