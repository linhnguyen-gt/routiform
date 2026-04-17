import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-nvidia-models-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const modelsRoute = await import("../../src/app/api/providers/[id]/models/route.ts");
const { setSafeOutboundDnsLookupForTesting, resetSafeOutboundDnsLookupForTesting } =
  await import("../../src/lib/network/safeOutboundFetch.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test.beforeEach(() => {
  setSafeOutboundDnsLookupForTesting(async () => [{ address: "93.184.216.34", family: 4 }]);
});

test.afterEach(() => {
  resetSafeOutboundDnsLookupForTesting();
});

test("NVIDIA models route uses canonical /v1/models endpoint from configured base URL", async () => {
  await resetStorage();

  const connection = await providersDb.createProviderConnection({
    provider: "nvidia",
    authType: "apikey",
    name: "nvidia-main",
    apiKey: "nvidia-token",
    providerSpecificData: {
      baseUrl: "https://nim.example.com/v1/chat/completions",
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    assert.equal(target, "https://nim.example.com/v1/models");
    assert.equal(init.method, "GET");
    assert.equal(init.headers.Authorization, "Bearer nvidia-token");
    return Response.json({
      data: [{ id: "meta/llama-3.1-8b-instruct", owned_by: "nvidia" }],
    });
  };

  try {
    const response = await modelsRoute.GET(
      new Request(`http://localhost/api/providers/${connection.id}/models`),
      { params: { id: connection.id } }
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.provider, "nvidia");
    assert.deepEqual(body.models, [{ id: "meta/llama-3.1-8b-instruct", owned_by: "nvidia" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("NVIDIA models route blocks private model endpoint base URLs", async () => {
  await resetStorage();

  const connection = await providersDb.createProviderConnection({
    provider: "nvidia",
    authType: "apikey",
    name: "nvidia-private-base",
    apiKey: "nvidia-token",
    providerSpecificData: {
      baseUrl: "http://127.0.0.1:8080/v1/chat/completions",
    },
  });

  const response = await modelsRoute.GET(
    new Request(`http://localhost/api/providers/${connection.id}/models`),
    { params: { id: connection.id } }
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(String(body.error || ""), /Blocked outbound request/i);
});
