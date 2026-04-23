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

test("phase2: xiaomi-mimo-token-plan executor uses cluster root + __routiformTargetFormat", async () => {
  const { DefaultExecutor } = await import("../../open-sse/executors/default.ts");
  const creds = (fmt) => ({
    providerSpecificData: {
      baseUrl: "https://token-plan-sgp.xiaomimimo.com",
      __routiformTargetFormat: fmt,
    },
  });
  const ex = new DefaultExecutor("xiaomi-mimo-token-plan");
  assert.equal(
    ex.buildUrl("mimo-v2-pro", true, 0, creds("openai")),
    "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions"
  );
  assert.equal(
    ex.buildUrl("mimo-v2-pro", true, 0, creds("claude")),
    "https://token-plan-sgp.xiaomimimo.com/anthropic/v1/messages"
  );
});

test("phase2: getTargetFormat uses sourceFormat for xiaomi-mimo-token-plan", async () => {
  const { getTargetFormat } = await import("../../open-sse/services/provider.ts");
  assert.equal(getTargetFormat("xiaomi-mimo-token-plan", {}, { sourceFormat: "openai" }), "openai");
  assert.equal(getTargetFormat("xiaomi-mimo-token-plan", {}, { sourceFormat: "claude" }), "claude");
});

test("phase2: registry xiaomi-mimo-token-plan entry exists", async () => {
  const { REGISTRY } = await import("../../open-sse/config/providerRegistry.ts");
  assert.ok(REGISTRY["xiaomi-mimo-token-plan"], "token plan registry entry should exist");
  assert.equal(REGISTRY["xiaomi-mimo-token-plan"].alias, "mimotp");
  assert.equal(REGISTRY["xiaomi-mimo-token-plan"].baseUrl, "https://token-plan-cn.xiaomimimo.com");
});

test("phase2: xiaomi token plan models URL from cluster root", async () => {
  const { buildXiaomiMimoTokenPlanModelsUrl } =
    await import("../../src/app/api/providers/[id]/models/xiaomi-mimo-token-plan-models-url.ts");
  assert.equal(
    buildXiaomiMimoTokenPlanModelsUrl("https://token-plan-cn.xiaomimimo.com"),
    "https://token-plan-cn.xiaomimimo.com/v1/models"
  );
  assert.equal(
    buildXiaomiMimoTokenPlanModelsUrl("https://token-plan-sgp.xiaomimimo.com/v1"),
    "https://token-plan-sgp.xiaomimimo.com/v1/models"
  );
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
