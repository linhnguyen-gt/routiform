# T04 · `X-Session-Id` Header for External Sticky Routing

**Priority:** 🔴 P1 — Nginx Users / Sticky Session
**Effort:** Small (1–2h)
**Phase:** 1 — Current branch

---

## Problem

OmniRoute generates session IDs internally (content hash of the conversation). There is no way for a client to explicitly pin a conversation to a specific account. This breaks in two scenarios:

1. **Nginx reverse proxy:** Nginx drops headers with underscores by default. If a client sends `session_id`, it gets dropped silently. sub2api's README explicitly notes: add `underscores_in_headers on` to Nginx config. We should accept the hyphenated `X-Session-Id` form which Nginx passes cleanly.

2. **Multi-account clients:** Tools like Codex or Claude Code that maintain multi-turn conversations may not send identical first messages — causing OmniRoute to generate a different session ID per turn, defeating sticky routing.

---

## References

| Source          | Link                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| sub2api README  | Nginx note: `underscores_in_headers on` for `session_id` header                                       |
| sub2api PR #634 | [stabilize session hash + add user-level session limit](https://github.com/Wei-Shaw/sub2api/pull/634) |
| OmniRoute       | `open-sse/services/sessionManager.ts`                                                                 |

---

## Implementation Steps

### Step 1 — Read `X-Session-Id` from Incoming Request

In `open-sse/chatCore.js` at the start of the request handler:

```js
// Priority: client-provided session ID > internally generated hash
const clientSessionId =
  req.headers["x-session-id"] || // hyphenated (Nginx passes this)
  req.headers["x_session_id"] || // underscore (direct HTTP, no Nginx)
  req.headers["session-id"] || // alternate form
  null;

const sessionId = clientSessionId
  ? `ext:${clientSessionId}` // prefix to avoid collision with internal IDs
  : generateSessionHash(body, req); // existing logic
```

### Step 2 — Pass Session ID to Sticky Routing

In `open-sse/services/sessionManager.ts`, the `getOrBindConnection()` function already accepts a session ID — just pass the external one:

```typescript
const connection = await sessionManager.getOrBindConnection({
  sessionId, // external if provided, internal hash otherwise
  providerId,
  comboId,
});
```

### Step 3 — Propagate Session ID in Response Headers

Echo back the session ID so clients know what was used:

```js
// In response handler
res.setHeader("X-OmniRoute-Session-Id", sessionId);
```

### Step 4 — Document Nginx Configuration

Add to `docs/` and the dashboard Endpoints tab:

```nginx
http {
  underscores_in_headers on;  # Required for X-Session-Id (or session_id) header
  ...
}
```

And in the Claude Code / Codex setup guide, document:

```bash
# Pin your session to the same Codex account for long conversations
export ANTHROPIC_EXTRA_HEADERS='{"X-Session-Id": "my-project-session-1"}'
```

---

## Files to Change

| File                                      | Action                                         |
| ----------------------------------------- | ---------------------------------------------- |
| `open-sse/chatCore.js`                    | Read `x-session-id` header at request entry    |
| `open-sse/services/sessionManager.ts`     | Accept external session ID as primary key      |
| `open-sse/chatCore.js`                    | Echo back `X-OmniRoute-Session-Id` in response |
| `docs/` or provider setup guides          | Document Nginx `underscores_in_headers on`     |
| `src/app/(dashboard)/dashboard/endpoint/` | Mention in API Endpoints tab                   |

---

## Acceptance Criteria

- [ ] `X-Session-Id: abc123` header binds conversation to same account
- [ ] `x_session_id` underscore form also accepted (direct HTTP without Nginx)
- [ ] Response includes `X-OmniRoute-Session-Id` header
- [ ] Without the header, existing session hash behavior unchanged
- [ ] Nginx setup guide mentions `underscores_in_headers on`
