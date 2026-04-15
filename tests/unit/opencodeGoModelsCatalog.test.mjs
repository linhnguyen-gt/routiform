/**
 * Unit tests for opencode-go models.dev catalog integration
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

// Mock fetch globally
const originalFetch = globalThis.fetch;

describe("opencodeGoModelsCatalog", () => {
  it("should fetch models from models.dev successfully", async () => {
    const mockResponse = {
      providers: {
        "opencode-go": {
          id: "opencode-go",
          models: {
            "glm-5": { id: "glm-5", name: "GLM-5", limit: { context: 128000 } },
            "kimi-k2.5": { id: "kimi-k2.5", name: "Kimi K2.5", limit: { context: 200000 } },
          },
        },
      },
    };

    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }));

    const { getOpencodeGoModels } =
      await import("../../src/lib/providers/opencodeGoModelsCatalog.ts");
    const models = await getOpencodeGoModels();

    assert.equal(models.length, 2);
    assert.equal(models[0].id, "glm-5");
    assert.equal(models[0].name, "GLM-5");
    assert.equal(models[0].contextLength, 128000);
    assert.equal(models[1].id, "kimi-k2.5");

    globalThis.fetch = originalFetch;
  });

  it("should fallback to static list on fetch error", async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error("Network error");
    });

    const { getOpencodeGoModels } =
      await import("../../src/lib/providers/opencodeGoModelsCatalog.ts");
    const models = await getOpencodeGoModels();

    assert.ok(models.length > 0, "Should return fallback models");
    assert.ok(
      models.some((m) => m.id === "glm-5"),
      "Should include glm-5 in fallback"
    );

    globalThis.fetch = originalFetch;
  });

  it("should fallback to static list on invalid response", async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ invalid: "data" }),
    }));

    // Clear cache to force fresh fetch
    const { refreshOpencodeGoModels } =
      await import("../../src/lib/providers/opencodeGoModelsCatalog.ts");
    const models = await refreshOpencodeGoModels();

    assert.ok(models.length > 0, "Should return fallback models");
    assert.ok(
      models.some((m) => m.id === "glm-5"),
      "Should include glm-5 in fallback"
    );

    globalThis.fetch = originalFetch;
  });

  it("should return static fallback list directly", async () => {
    const { getOpencodeGoStaticModels } =
      await import("../../src/lib/providers/opencodeGoModelsCatalog.ts");
    const models = getOpencodeGoStaticModels();

    assert.ok(Array.isArray(models));
    assert.ok(models.length >= 6);
    assert.ok(models.every((m) => m.id && m.name));
  });

  it("should cache models for TTL duration", async () => {
    const mockResponse = {
      providers: {
        "opencode-go": {
          id: "opencode-go",
          models: {
            "test-model": { id: "test-model", name: "Test Model" },
          },
        },
      },
    };

    let fetchCallCount = 0;
    globalThis.fetch = mock.fn(async () => {
      fetchCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => mockResponse,
      };
    });

    // Clear cache first
    const { refreshOpencodeGoModels, getOpencodeGoModels } =
      await import("../../src/lib/providers/opencodeGoModelsCatalog.ts");

    await refreshOpencodeGoModels();
    fetchCallCount = 0; // Reset counter after initial fetch

    await getOpencodeGoModels();
    await getOpencodeGoModels();
    await getOpencodeGoModels();

    assert.equal(fetchCallCount, 0, "Should use cache, not fetch again");

    globalThis.fetch = originalFetch;
  });
});
