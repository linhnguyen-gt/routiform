import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Context Compression Metrics", () => {
  describe("recordContextCompression", () => {
    it("should track compression events", async () => {
      const { recordContextCompression, getComboMetrics, resetComboMetrics } =
        await import("../../open-sse/services/comboMetrics.ts");

      resetComboMetrics("test-combo");

      // Record compression
      recordContextCompression("test-combo", "openai/gpt-4", 10000, 5000);

      const metrics = getComboMetrics("test-combo");
      assert.ok(metrics, "Should have metrics");
      assert.strictEqual(metrics.contextCompressions, 1, "Should track compression count");
      assert.ok(metrics.avgCompressionRatio, "Should calculate compression ratio");
      assert.strictEqual(metrics.avgCompressionRatio, 50, "Should be 50% compression ratio");
    });

    it("should track multiple compressions", async () => {
      const { recordContextCompression, getComboMetrics, resetComboMetrics } =
        await import("../../open-sse/services/comboMetrics.ts");

      resetComboMetrics("test-combo-multi");

      // Record multiple compressions
      recordContextCompression("test-combo-multi", "openai/gpt-4", 10000, 5000); // 50%
      recordContextCompression("test-combo-multi", "openai/gpt-4", 8000, 6000); // 75%

      const metrics = getComboMetrics("test-combo-multi");
      assert.strictEqual(metrics.contextCompressions, 2, "Should track 2 compressions");
      assert.ok(
        metrics.avgCompressionRatio >= 62 && metrics.avgCompressionRatio <= 63,
        "Should average to ~62-63% ((50+75)/2)"
      );
    });

    it("should track per-model compression", async () => {
      const { recordContextCompression, getComboMetrics, resetComboMetrics } =
        await import("../../open-sse/services/comboMetrics.ts");

      resetComboMetrics("test-combo");

      recordContextCompression("test-combo", "openai/gpt-4", 10000, 5000);
      recordContextCompression("test-combo", "anthropic/claude-3", 8000, 4000);

      const metrics = getComboMetrics("test-combo");
      assert.ok(metrics.byModel["openai/gpt-4"], "Should have gpt-4 metrics");
      assert.ok(metrics.byModel["anthropic/claude-3"], "Should have claude metrics");
      assert.strictEqual(
        metrics.byModel["openai/gpt-4"].contextCompressions,
        1,
        "GPT-4 should have 1 compression"
      );
      assert.strictEqual(
        metrics.byModel["anthropic/claude-3"].contextCompressions,
        1,
        "Claude should have 1 compression"
      );
    });
  });

  describe("recordContextRejection", () => {
    it("should track rejection events", async () => {
      const { recordContextRejection, getComboMetrics, resetComboMetrics } =
        await import("../../open-sse/services/comboMetrics.ts");

      resetComboMetrics("test-combo");

      recordContextRejection("test-combo", "openai/gpt-4");

      const metrics = getComboMetrics("test-combo");
      assert.strictEqual(metrics.contextRejections, 1, "Should track rejection count");
    });

    it("should track multiple rejections", async () => {
      const { recordContextRejection, getComboMetrics, resetComboMetrics } =
        await import("../../open-sse/services/comboMetrics.ts");

      resetComboMetrics("test-combo-2");

      recordContextRejection("test-combo-2", "openai/gpt-4");
      recordContextRejection("test-combo-2", "openai/gpt-4");
      recordContextRejection("test-combo-2", "anthropic/claude-3");

      const metrics = getComboMetrics("test-combo-2");
      assert.strictEqual(metrics.contextRejections, 3, "Should track 3 rejections");
      assert.strictEqual(
        metrics.byModel["openai/gpt-4"].contextRejections,
        2,
        "GPT-4 should have 2 rejections"
      );
      assert.strictEqual(
        metrics.byModel["anthropic/claude-3"].contextRejections,
        1,
        "Claude should have 1 rejection"
      );
    });
  });

  describe("Combined metrics", () => {
    it("should track both compressions and rejections", async () => {
      const {
        recordContextCompression,
        recordContextRejection,
        getComboMetrics,
        resetComboMetrics,
      } = await import("../../open-sse/services/comboMetrics.ts");

      resetComboMetrics("test-combo");

      // Some requests compress successfully
      recordContextCompression("test-combo", "openai/gpt-4", 10000, 5000);
      recordContextCompression("test-combo", "openai/gpt-4", 8000, 6000);

      // Some requests still exceed limit after compression
      recordContextRejection("test-combo", "openai/gpt-4");

      const metrics = getComboMetrics("test-combo");
      assert.strictEqual(metrics.contextCompressions, 2, "Should have 2 compressions");
      assert.strictEqual(metrics.contextRejections, 1, "Should have 1 rejection");
      assert.ok(metrics.avgCompressionRatio, "Should have compression ratio");
    });
  });
});
