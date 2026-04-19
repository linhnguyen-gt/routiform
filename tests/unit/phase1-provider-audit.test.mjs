import test from "node:test";
import assert from "node:assert/strict";

test("Phase1: provider audit metadata redacts sensitive fields", async () => {
  const { buildProviderAuditMetadata } = await import("../../src/lib/compliance/providerAudit.ts");

  const metadata = buildProviderAuditMetadata({
    provider: "codex",
    connectionId: "conn_123",
    action: "provider.update",
    details: {
      apiKey: "sk-abc",
      accessToken: "tok-1",
      nested: {
        password: "secret",
        safe: "ok",
      },
    },
  });

  assert.equal(metadata.action, "provider.update");
  assert.equal(metadata.target, "provider:codex:conn_123");
  assert.equal(metadata.actor, "system");
  assert.equal(metadata.details.apiKey, "[REDACTED]");
  assert.equal(metadata.details.accessToken, "[REDACTED]");
  assert.equal(metadata.details.nested.password, "[REDACTED]");
  assert.equal(metadata.details.nested.safe, "ok");
});
