import test from "node:test";
import assert from "node:assert/strict";

const { respondComboModelsExhausted } =
  await import("../../open-sse/services/combo/combo-exhausted-responses.ts");

function baseOptions(overrides) {
  return {
    logTag: "COMBO",
    orderedModels: ["m1"],
    combo: { name: "t-combo" },
    strategy: "priority",
    lastTriedModelIndex: 0,
    lastTriedModelStr: "m1",
    fallbackCount: 1,
    startTime: Date.now() - 1,
    earliestRetryAfter: null,
    exhaustedDefaultMessage: "exhausted",
    log: { warn: () => {} },
    ...overrides,
  };
}

test("combo exhausted: null status + no error => ALL_ACCOUNTS_INACTIVE (not quality masquerade)", async () => {
  const res = await respondComboModelsExhausted(baseOptions({ lastStatus: null, lastError: null }));
  assert.equal(res.status, 503);
  const body = JSON.parse(await res.text());
  assert.equal(body.error?.code, "ALL_ACCOUNTS_INACTIVE");
});

test("combo exhausted: null status + lastError => COMBO_MODELS_EXHAUSTED (quality gap)", async () => {
  const res = await respondComboModelsExhausted(
    baseOptions({
      lastStatus: null,
      lastError: "Response failed quality validation",
    })
  );
  assert.equal(res.status, 503);
  const body = JSON.parse(await res.text());
  assert.equal(body.error?.code, "COMBO_MODELS_EXHAUSTED");
  assert.match(String(body.error?.message || ""), /quality validation/);
});

test("combo exhausted: terminal 200 + error message propagates", async () => {
  const res = await respondComboModelsExhausted(
    baseOptions({
      lastStatus: 200,
      lastError: "bad_quality: empty assistant text",
    })
  );
  assert.equal(res.status, 200);
  const body = JSON.parse(await res.text());
  assert.match(String(body.error?.message || ""), /bad_quality/);
});
