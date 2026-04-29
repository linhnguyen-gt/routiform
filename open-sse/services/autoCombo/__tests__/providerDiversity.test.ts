import { describe, it, beforeEach } from "vitest";
import assert from "node:assert/strict";
import {
  recordProviderUsage,
  calculateDiversityScore,
  getProviderDiversityBoost,
  getDiversityReport,
  resetDiversity,
  configureDiversity,
} from "../providerDiversity";

describe("providerDiversity", () => {
  beforeEach(() => {
    resetDiversity();
  });

  describe("calculateDiversityScore", () => {
    it("returns 1.0 when no data is recorded", () => {
      assert.equal(calculateDiversityScore(), 1.0);
    });

    it("returns 0.0 when all requests go to one provider", () => {
      for (let i = 0; i < 20; i++) {
        recordProviderUsage("claude");
      }
      assert.equal(calculateDiversityScore(), 0.0);
    });

    it("returns 1.0 for perfectly even distribution across 2 providers", () => {
      for (let i = 0; i < 10; i++) {
        recordProviderUsage("claude");
        recordProviderUsage("openai");
      }
      assert.equal(calculateDiversityScore(), 1.0);
    });

    it("returns value between 0 and 1 for uneven distribution", () => {
      for (let i = 0; i < 15; i++) recordProviderUsage("claude");
      for (let i = 0; i < 5; i++) recordProviderUsage("openai");

      const score = calculateDiversityScore();
      assert.ok(score > 0, "should be > 0 (not single provider)");
      assert.ok(score < 1, "should be < 1 (not perfectly even)");
    });

    it("higher entropy with more providers", () => {
      // 2 providers
      resetDiversity();
      for (let i = 0; i < 10; i++) {
        recordProviderUsage("claude");
        recordProviderUsage("openai");
      }
      const score2 = calculateDiversityScore();

      // 4 providers (same total requests)
      resetDiversity();
      for (let i = 0; i < 5; i++) {
        recordProviderUsage("claude");
        recordProviderUsage("openai");
        recordProviderUsage("google");
        recordProviderUsage("together");
      }
      const score4 = calculateDiversityScore();

      // Both should be 1.0 (perfectly distributed within their pool)
      assert.equal(score2, 1.0);
      assert.equal(score4, 1.0);
    });
  });

  describe("getProviderDiversityBoost", () => {
    it("returns 0.5 when no data is recorded", () => {
      assert.equal(getProviderDiversityBoost("claude"), 0.5);
    });

    it("returns low boost for heavily used provider", () => {
      for (let i = 0; i < 18; i++) recordProviderUsage("claude");
      for (let i = 0; i < 2; i++) recordProviderUsage("openai");

      const claudeBoost = getProviderDiversityBoost("claude");
      const openaiBoost = getProviderDiversityBoost("openai");

      assert.ok(claudeBoost < openaiBoost, "heavily used provider should have lower boost");
      assert.ok(claudeBoost < 0.2, "90% used provider should have very low boost");
      assert.ok(openaiBoost > 0.8, "10% used provider should have high boost");
    });

    it("returns 1.0 for never-used provider", () => {
      for (let i = 0; i < 10; i++) recordProviderUsage("claude");

      const boost = getProviderDiversityBoost("google");
      assert.equal(boost, 1.0);
    });
  });

  describe("getDiversityReport", () => {
    it("returns structured report", () => {
      recordProviderUsage("claude");
      recordProviderUsage("claude");
      recordProviderUsage("openai");

      const report = getDiversityReport();

      assert.equal(report.totalRequests, 3);
      assert.ok(report.score > 0);
      assert.ok(report.score < 1);
      assert.equal(report.providers["claude"].count, 2);
      assert.equal(report.providers["openai"].count, 1);
      assert.ok(Math.abs(report.providers["claude"].share - 2 / 3) < 0.01);
    });
  });

  describe("window management", () => {
    it("respects windowSize limit", () => {
      configureDiversity({ windowSize: 10, ttlMs: 3_600_000 });

      for (let i = 0; i < 20; i++) {
        recordProviderUsage("claude");
      }

      const report = getDiversityReport();
      assert.ok(report.totalRequests <= 10, "should not exceed window size");
    });
  });
});
