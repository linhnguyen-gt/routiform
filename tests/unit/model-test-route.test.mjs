import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-model-test-route-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const route = await import("../../src/app/api/models/test/route.ts");

const originalFetch = globalThis.fetch;
const originalModelTestUseFetch = process.env.ROUTIFORM_MODEL_TEST_USE_FETCH;

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

function makeRequest(model = "kilocode/openai/gpt-5.3-codex") {
  return new Request("http://localhost/api/models/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model }),
  });
}

test.beforeEach(async () => {
  process.env.ROUTIFORM_MODEL_TEST_USE_FETCH = "1";
  globalThis.fetch = originalFetch;
  await resetStorage();
});

test.afterEach(() => {
  if (originalModelTestUseFetch === undefined) {
    delete process.env.ROUTIFORM_MODEL_TEST_USE_FETCH;
  } else {
    process.env.ROUTIFORM_MODEL_TEST_USE_FETCH = originalModelTestUseFetch;
  }
  globalThis.fetch = originalFetch;
});

test.after(() => {
  if (originalModelTestUseFetch === undefined) {
    delete process.env.ROUTIFORM_MODEL_TEST_USE_FETCH;
  } else {
    process.env.ROUTIFORM_MODEL_TEST_USE_FETCH = originalModelTestUseFetch;
  }
  globalThis.fetch = originalFetch;
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("model test route fails when provider embeds status 402 in HTTP 200 payload", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        status: 402,
        msg: "Payment required",
        choices: [
          {
            message: {
              role: "assistant",
              content: "OK",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );

  const response = await route.POST(makeRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, false);
  assert.equal(body.status, 200);
  assert.match(body.error, /provider status 402/i);
});

test("model test route passes only when assistant text is extractable", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: "OK",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );

  const response = await route.POST(makeRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.error, null);
});

test("model test route fails when assistant text is an embedded provider error message", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: "[402]: This is a paid model. To use paid models, you need to add credits.",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );

  const response = await route.POST(makeRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, false);
  assert.match(body.error, /\[402\]/i);
});

test("model test route returns timeout payload when upstream fetch stalls", async () => {
  globalThis.fetch = (_input, init) =>
    new Promise((resolve, reject) => {
      let slowResponseTimer = null;
      const signal = init && "signal" in init ? init.signal : undefined;
      if (signal && "addEventListener" in signal) {
        signal.addEventListener("abort", () => {
          if (slowResponseTimer) clearTimeout(slowResponseTimer);
          const abortError = new Error("aborted due to timeout");
          abortError.name = "AbortError";
          reject(abortError);
        });
      }
      slowResponseTimer = setTimeout(() => {
        resolve(
          new Response(
            JSON.stringify({ choices: [{ message: { role: "assistant", content: "OK" } }] }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        );
      }, 30_000);
    });

  const response = await route.POST(makeRequest());
  const body = await response.json();

  assert.equal(response.status, 504);
  assert.equal(body.ok, false);
  assert.equal(body.status, 504);
  assert.equal(body.error, "Model test timeout (30s)");
});
