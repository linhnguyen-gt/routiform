import test from "node:test";
import assert from "node:assert/strict";

const {
  normalizeCodexModelsBaseUrl,
  buildCodexModelsEndpoints,
  mapCodexModelsFromApi,
  buildNvidiaModelsUrl,
} = await import("../../src/app/api/providers/[id]/models/route.ts");

test("codex models helper normalizes responses base url", () => {
  assert.equal(
    normalizeCodexModelsBaseUrl("https://chatgpt.com/backend-api/codex/responses"),
    "https://chatgpt.com/backend-api/codex"
  );
  assert.equal(
    normalizeCodexModelsBaseUrl("https://chatgpt.com/backend-api/codex/"),
    "https://chatgpt.com/backend-api/codex"
  );
});

test("codex models helper builds unique endpoint candidates", () => {
  const endpoints = buildCodexModelsEndpoints("https://chatgpt.com/backend-api/codex");
  assert.deepEqual(endpoints, [
    "https://chatgpt.com/backend-api/codex/models",
    "https://chatgpt.com/backend-api/codex/v1/models",
    "https://chatgpt.com/backend-api/codex/api/codex/models",
  ]);
});

test("nvidia models helper builds canonical /v1/models endpoint", () => {
  assert.equal(
    buildNvidiaModelsUrl("https://integrate.api.nvidia.com/v1/chat/completions"),
    "https://integrate.api.nvidia.com/v1/models"
  );
  assert.equal(
    buildNvidiaModelsUrl("https://nim.example.com/v1/chat/completions"),
    "https://nim.example.com/v1/models"
  );
  assert.equal(
    buildNvidiaModelsUrl("https://nim.example.com/v1"),
    "https://nim.example.com/v1/models"
  );
  assert.equal(
    buildNvidiaModelsUrl("https://nim.example.com"),
    "https://nim.example.com/v1/models"
  );
});

test("codex models helper maps API payload and hides non-list entries", () => {
  const payload = {
    models: [
      { slug: "gpt-5.4", display_name: "gpt-5.4", visibility: "list" },
      { slug: "gpt-5.4-mini", display_name: "gpt-5.4-mini", visibility: "list" },
      { slug: "gpt-5.3-codex", display_name: "gpt-5.3-codex", visibility: "list" },
      { slug: "gpt-5.2", display_name: "gpt-5.2", visibility: "list" },
      { slug: "gpt-oss-120b", display_name: "gpt-oss-120b", visibility: "list" },
      { slug: "gpt-5.2-codex", display_name: "gpt-5.2-codex", visibility: "list" },
      { slug: "hidden-model", display_name: "Hidden", visibility: "hidden" },
    ],
  };

  const visible = mapCodexModelsFromApi(payload, false);
  const visibleIds = visible.map((m) => m.id);

  // Should include fallback models + API models (excluding disabled)
  assert.ok(visibleIds.includes("gpt-5.5"), "Should include gpt-5.5 from fallback");
  assert.ok(visibleIds.includes("gpt-5.4"), "Should include gpt-5.4");
  assert.ok(visibleIds.includes("gpt-5.4-mini"), "Should include gpt-5.4-mini");
  assert.ok(visibleIds.includes("gpt-5.3-codex"), "Should include gpt-5.3-codex");
  assert.ok(
    visibleIds.includes("gpt-5.3-codex-spark"),
    "Should include gpt-5.3-codex-spark from fallback"
  );
  assert.ok(visibleIds.includes("gpt-5.2"), "Should include gpt-5.2");
  assert.ok(visibleIds.includes("gpt-5"), "Should include gpt-5 from fallback");
  assert.ok(visibleIds.includes("gpt-5.2-codex"), "Should include gpt-5.2-codex from API");

  // Should exclude disabled models
  assert.equal(
    visible.some((m) => m.id === "gpt-oss-120b"),
    false,
    "Should exclude disabled gpt-oss-120b"
  );

  const all = mapCodexModelsFromApi(payload, true);
  assert.ok(all.length >= 7, "Should have at least 7 models (fallback + API)");
  assert.equal(
    all.some((m) => m.id === "gpt-oss-120b"),
    false,
    "Should exclude disabled models even with includeHidden=true"
  );
  // When includeHidden=true, hidden models from API should be included
  assert.equal(
    all.some((m) => m.id === "hidden-model"),
    true,
    "Should include hidden models when includeHidden=true"
  );
});

test("codex models helper backfills curated defaults when API payload is incomplete", () => {
  const payload = {
    models: [{ slug: "gpt-5.2", display_name: "gpt-5.2", visibility: "list" }],
  };

  const visible = mapCodexModelsFromApi(payload, false);
  const visibleIds = visible.map((m) => m.id);

  // Should include all fallback models even when API only returns one
  assert.ok(visibleIds.includes("gpt-5.5"), "Should include gpt-5.5 from fallback");
  assert.ok(visibleIds.includes("gpt-5.4"), "Should include gpt-5.4 from fallback");
  assert.ok(visibleIds.includes("gpt-5.4-mini"), "Should include gpt-5.4-mini from fallback");
  assert.ok(visibleIds.includes("gpt-5.3-codex"), "Should include gpt-5.3-codex from fallback");
  assert.ok(
    visibleIds.includes("gpt-5.3-codex-spark"),
    "Should include gpt-5.3-codex-spark from fallback"
  );
  assert.ok(visibleIds.includes("gpt-5.2"), "Should include gpt-5.2 from API");
  assert.ok(visibleIds.includes("gpt-5"), "Should include gpt-5 from fallback");
});
