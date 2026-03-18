import test from "node:test";
import assert from "node:assert/strict";

const { validateProviderApiKey } = await import("../../src/lib/providers/validation.ts");

test("serper validation accepts authenticated non-auth upstream errors", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "credits_exhausted" }), {
      status: 402,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await validateProviderApiKey({
      provider: "serper-search",
      apiKey: "valid-serper-key",
    });

    assert.equal(result.valid, true);
    assert.equal(result.error, null);
    assert.equal(result.unsupported, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serper validation still rejects unauthorized keys", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await validateProviderApiKey({
      provider: "serper-search",
      apiKey: "bad-serper-key",
    });

    assert.equal(result.valid, false);
    assert.equal(result.error, "Invalid API key");
    assert.equal(result.unsupported, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
