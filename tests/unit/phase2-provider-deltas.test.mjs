import test from "node:test";
import assert from "node:assert/strict";

const originalPerplexityFlag = process.env.ENABLE_PERPLEXITY_WEB_PROVIDER;
const originalGrokFlag = process.env.ENABLE_GROK_WEB_PROVIDER;

test.after(() => {
  if (originalPerplexityFlag === undefined) {
    delete process.env.ENABLE_PERPLEXITY_WEB_PROVIDER;
  } else {
    process.env.ENABLE_PERPLEXITY_WEB_PROVIDER = originalPerplexityFlag;
  }

  if (originalGrokFlag === undefined) {
    delete process.env.ENABLE_GROK_WEB_PROVIDER;
  } else {
    process.env.ENABLE_GROK_WEB_PROVIDER = originalGrokFlag;
  }
});

test("phase2: registry exposes glmt defaults and timeout", async () => {
  const { REGISTRY } = await import("../../open-sse/config/providerRegistry.ts");
  assert.ok(REGISTRY.glmt, "glmt registry entry should exist");
  assert.equal(REGISTRY.glmt.timeoutMs, 180000);
  assert.deepEqual(REGISTRY.glmt.requestDefaults, {
    thinking: { type: "enabled" },
  });
});

test("phase2: registry xiaomi-mimo defaults to canonical endpoint and new models", async () => {
  const { REGISTRY } = await import("../../open-sse/config/providerRegistry.ts");
  assert.ok(REGISTRY["xiaomi-mimo"], "xiaomi-mimo registry entry should exist");
  assert.equal(REGISTRY["xiaomi-mimo"].baseUrl, "https://api.xiaomimimo.com/v1");

  const modelIds = REGISTRY["xiaomi-mimo"].models.map((m) => m.id);
  assert.ok(modelIds.includes("mimo-v2-pro"));
  assert.ok(modelIds.includes("mimo-v2-omni"));
  assert.ok(modelIds.includes("mimo-v2-tts"));
});

test("phase2: web-session providers are gated off by default", async () => {
  delete process.env.ENABLE_PERPLEXITY_WEB_PROVIDER;
  delete process.env.ENABLE_GROK_WEB_PROVIDER;

  const { APIKEY_PROVIDERS } = await import("../../src/shared/constants/providers.ts");
  assert.equal(APIKEY_PROVIDERS["perplexity-web"], undefined);
  assert.equal(APIKEY_PROVIDERS["grok-web"], undefined);
});

test("phase2: default executor normalizes xiaomi token-plan regional URLs", async () => {
  const { DefaultExecutor } = await import("../../open-sse/executors/default.ts");
  const executor = new DefaultExecutor("xiaomi-mimo");

  const normalizedUrl = executor.buildUrl("mimo-v2-pro", true, 0, {
    providerSpecificData: {
      baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1",
    },
  });

  assert.equal(normalizedUrl, "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions");
});

test("phase2: provider request defaults apply only missing fields", async () => {
  const { applyProviderRequestDefaults } =
    await import("../../open-sse/services/providerRequestDefaults.ts");

  const baseBody = {
    model: "glm-5",
    messages: [{ role: "user", content: "hello" }],
  };

  const applied = applyProviderRequestDefaults(baseBody, {
    serviceTier: "priority",
    reasoningEffort: "high",
    thinking: { type: "enabled" },
  });

  assert.equal(applied.service_tier, "priority");
  assert.deepEqual(applied.reasoning, { effort: "high" });
  assert.deepEqual(applied.thinking, { type: "enabled" });

  const preserve = applyProviderRequestDefaults(
    {
      ...baseBody,
      service_tier: "fast",
      reasoning: { effort: "low" },
      thinking: { type: "disabled" },
    },
    {
      serviceTier: "priority",
      reasoningEffort: "high",
      thinking: { type: "enabled" },
    }
  );

  assert.equal(preserve.service_tier, "fast");
  assert.deepEqual(preserve.reasoning, { effort: "low" });
  assert.deepEqual(preserve.thinking, { type: "disabled" });
});
