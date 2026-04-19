import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-phase2-count-tokens-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const countTokensRoute = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

const originalFetch = globalThis.fetch;

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.after(async () => {
  globalThis.fetch = originalFetch;
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("phase2 count_tokens: glm uses upstream count_tokens endpoint when available", async () => {
  await resetStorage();
  await providersDb.createProviderConnection({
    provider: "glm",
    authType: "apikey",
    name: "glm-default",
    apiKey: "glm-token",
    isActive: 1,
  });

  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    assert.equal(String(url), "https://api.z.ai/api/coding/paas/v4/count_tokens");
    assert.equal(init.headers.Authorization, "Bearer glm-token");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "glm-5");
    return Response.json({ input_tokens: 42 });
  };

  const response = await countTokensRoute.POST(
    new Request("http://localhost/api/v1/messages/count_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "glm/glm-5",
        messages: [{ role: "user", content: "hello" }],
      }),
    })
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.input_tokens, 42);
  assert.equal(calls.length, 1);
});

test("phase2 count_tokens: glm gracefully falls back to local estimate when upstream unavailable", async () => {
  await resetStorage();
  await providersDb.createProviderConnection({
    provider: "glm",
    authType: "apikey",
    name: "glm-default",
    apiKey: "glm-token",
    isActive: 1,
  });

  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response("bad gateway", { status: 502 });
  };

  const response = await countTokensRoute.POST(
    new Request("http://localhost/api/v1/messages/count_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "glm/glm-5",
        messages: [{ role: "user", content: "12345678" }],
      }),
    })
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.input_tokens, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], "https://api.z.ai/api/coding/paas/v4/count_tokens");
  assert.equal(calls[1], "https://api.z.ai/api/coding/paas/v4/tokenizer");
});

test("phase2 count_tokens: non-glm models keep estimate-only behavior", async () => {
  await resetStorage();

  globalThis.fetch = async () => {
    throw new Error("fetch should not be called for non-glm models");
  };

  const response = await countTokensRoute.POST(
    new Request("http://localhost/api/v1/messages/count_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: "1234" }],
      }),
    })
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.input_tokens, 1);
});
