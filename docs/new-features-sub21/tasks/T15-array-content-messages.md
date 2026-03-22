# T15 · Array Content in System/Tool Messages

**Priority:** 🟡 P3 — SDK Compatibility
**Effort:** Tiny (<1h)
**Phase:** 3 — v3.x

---

## Problem

The OpenAI API spec allows `content` to be either a string OR an array of content blocks:

```json
// String form (most clients):
{"role": "system", "content": "You are a helpful assistant."}

// Array form (some SDKs, Cursor, Codex 2.x):
{"role": "system", "content": [{"type": "text", "text": "You are a helpful assistant."}]}
```

Some clients (Cursor, certain Python SDK versions, Codex 2.x) send the array form for system and tool messages. If OmniRoute's translator always assumes string content, these requests fail with parse errors or incorrect translations.

sub2api PR #1197: `fix(apicompat): support array content for system and tool messages`.

---

## References

| Source           | Link                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sub2api PR #1197 | [fix(apicompat): support array content for system and tool messages](https://github.com/Wei-Shaw/sub2api/commit/4feacf221319b67e5239cfe71ebf654d1bbf0cc6) |
| OpenAI spec      | Both string and array forms are valid                                                                                                                     |
| Affected clients | Cursor, some Python SDK versions, Codex 2.x                                                                                                               |

---

## Implementation Steps

### Step 1 — Add `normalizeContent()` Helper

In `open-sse/translator/openai-to-claude.ts` or a shared util:

```typescript
/**
 * Normalize content to a string.
 * Handles both string and array-of-blocks forms.
 */
export function normalizeContentToString(
  content: string | ContentBlock[] | null | undefined
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  // Array form: concatenate all text blocks
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}

/**
 * Normalize content to array form.
 * Handles both string and array-of-blocks forms.
 */
export function normalizeContentToArray(
  content: string | ContentBlock[] | null | undefined
): ContentBlock[] {
  if (!content) return [];
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  return content;
}
```

### Step 2 — Apply in Message Translation

In the translator, when processing system and tool messages:

```typescript
// When building Claude request from OpenAI format:
const systemContent = normalizeContentToString(body.system ?? messages[0]?.content);

// When forwarding tool messages:
const toolMessage = {
  role: "tool",
  content: normalizeContentToArray(msg.content),
};
```

### Step 3 — Apply in Request Body Parsing

In `open-sse/chatCore.js`, normalize before any downstream processing:

```js
// Normalize system message if it's in array form
if (Array.isArray(body.system)) {
  body.system = body.system
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Normalize message content
body.messages = body.messages?.map((msg) => ({
  ...msg,
  content: normalizeContent(msg.content),
}));
```

---

## Files to Change

| File                                      | Action                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| `open-sse/translator/openai-to-claude.ts` | `normalizeContentToString()` and `normalizeContentToArray()` |
| `open-sse/chatCore.js`                    | Normalize system + message content at entry                  |
| `open-sse/translator/`                    | Apply normalization in all translation paths                 |

---

## Acceptance Criteria

- [ ] `content: "string"` continues to work (no regression)
- [ ] `content: [{"type":"text","text":"..."}]` is correctly handled
- [ ] Array content in system messages is normalized to string for Claude
- [ ] Array content in tool messages is preserved as array for Anthropic
- [ ] Mixed content arrays (text + image) handled correctly
