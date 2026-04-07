import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-proxy-v1-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const proxyV1Route = await import("../../src/app/api/v1/management/proxies/route.ts");
const proxyAssignmentsV1Route =
  await import("../../src/app/api/v1/management/proxies/assignments/route.ts");
const proxyHealthV1Route = await import("../../src/app/api/v1/management/proxies/health/route.ts");
const proxyBulkAssignV1Route =
  await import("../../src/app/api/v1/management/proxies/bulk-assign/route.ts");
const proxyLogger = await import("../../src/lib/proxyLogger.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.after(async () => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("v1 management proxies supports create/list/pagination", async () => {
  await resetStorage();

  const createA = await proxyV1Route.POST(
    new Request("http://localhost/api/v1/management/proxies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Proxy A",
        type: "http",
        host: "proxy-a.local",
        port: 8080,
      }),
    })
  );
  assert.equal(createA.status, 201);

  const createB = await proxyV1Route.POST(
    new Request("http://localhost/api/v1/management/proxies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Proxy B",
        type: "https",
        host: "proxy-b.local",
        port: 443,
      }),
    })
  );
  assert.equal(createB.status, 201);

  const listRes = await proxyV1Route.GET(
    new Request("http://localhost/api/v1/management/proxies?limit=1&offset=0")
  );
  assert.equal(listRes.status, 200);
  const listPayload = await listRes.json();
  assert.equal(Array.isArray(listPayload.items), true);
  assert.equal(listPayload.items.length, 1);
  assert.equal(listPayload.page.total >= 2, true);
});

test("v1 management assignments supports put and filtered get", async () => {
  await resetStorage();

  const providerConn = await providersDb.createProviderConnection({
    provider: "openai",
    authType: "apikey",
    name: "v1-assignment",
    apiKey: "sk-test-v1",
  });

  const createdRes = await proxyV1Route.POST(
    new Request("http://localhost/api/v1/management/proxies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Proxy Assign",
        type: "http",
        host: "assign.local",
        port: 8000,
      }),
    })
  );
  const created = await createdRes.json();

  const assignRes = await proxyAssignmentsV1Route.PUT(
    new Request("http://localhost/api/v1/management/proxies/assignments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "account",
        scopeId: providerConn.id,
        proxyId: created.id,
      }),
    })
  );
  assert.equal(assignRes.status, 200);

  const filteredRes = await proxyAssignmentsV1Route.GET(
    new Request(
      `http://localhost/api/v1/management/proxies/assignments?scope=account&scope_id=${providerConn.id}`
    )
  );
  assert.equal(filteredRes.status, 200);
  const payload = await filteredRes.json();
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].proxyId, created.id);
});

test("v1 management health endpoint aggregates proxy log metrics", async () => {
  await resetStorage();

  const createdRes = await proxyV1Route.POST(
    new Request("http://localhost/api/v1/management/proxies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Proxy Health",
        type: "http",
        host: "health.local",
        port: 8080,
      }),
    })
  );
  const created = await createdRes.json();

  proxyLogger.logProxyEvent({
    status: "success",
    proxy: { type: "http", host: "health.local", port: 8080 },
    latencyMs: 120,
    level: "provider",
    levelId: "openai",
    provider: "openai",
  });
  proxyLogger.logProxyEvent({
    status: "error",
    proxy: { type: "http", host: "health.local", port: 8080 },
    latencyMs: 200,
    level: "provider",
    levelId: "openai",
    provider: "openai",
  });

  const healthRes = await proxyHealthV1Route.GET(
    new Request("http://localhost/api/v1/management/proxies/health?hours=24")
  );
  assert.equal(healthRes.status, 200);
  const healthPayload = await healthRes.json();
  const row = healthPayload.items.find((item) => item.proxyId === created.id);
  assert.ok(row);
  assert.equal(row.totalRequests >= 2, true);
  assert.equal(row.errorCount >= 1, true);
});

test("v1 bulk assignment updates multiple scope IDs in one request", async () => {
  await resetStorage();

  const proxyRes = await proxyV1Route.POST(
    new Request("http://localhost/api/v1/management/proxies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bulk Proxy",
        type: "http",
        host: "bulk.local",
        port: 8080,
      }),
    })
  );
  const proxy = await proxyRes.json();

  const bulkRes = await proxyBulkAssignV1Route.PUT(
    new Request("http://localhost/api/v1/management/proxies/bulk-assign", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "provider",
        scopeIds: ["openai", "anthropic"],
        proxyId: proxy.id,
      }),
    })
  );
  assert.equal(bulkRes.status, 200);
  const bulkPayload = await bulkRes.json();
  assert.equal(bulkPayload.updated, 2);

  const checkRes = await proxyAssignmentsV1Route.GET(
    new Request("http://localhost/api/v1/management/proxies/assignments?scope=provider")
  );
  const checkPayload = await checkRes.json();
  assert.equal(checkPayload.items.length >= 2, true);
});
