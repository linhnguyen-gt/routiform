import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-openai-compat-models-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const modelsRoute = await import("../../src/app/api/providers/[id]/models/route.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("openai-compatible models route returns policy error for private base URL instead of fallback", async () => {
  await resetStorage();

  const connection = await providersDb.createProviderConnection({
    provider: "openai-compatible-private-route",
    authType: "apikey",
    name: "compat-private",
    apiKey: "sk-test",
    providerSpecificData: {
      baseUrl: "http://127.0.0.1:11434/v1",
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("fetch should not be called for blocked outbound URLs");
  };

  try {
    const response = await modelsRoute.GET(
      new Request(`http://localhost/api/providers/${connection.id}/models`),
      { params: { id: connection.id } }
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(String(body.error || ""), /Blocked outbound request/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
