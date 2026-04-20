import test from "node:test";
import assert from "node:assert/strict";

const auditModule = await import("../../open-sse/mcp-server/audit.ts");

test("closeAuditDb is safe and idempotent without active connection", () => {
  assert.equal(auditModule.closeAuditDb(), false);
  assert.equal(auditModule.closeAuditDb(), false);
});
