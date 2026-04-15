import { describe, it } from "node:test";
import assert from "node:assert";

// Import the functions to test
const { matchesSidebarHref, getActiveSidebarHref } =
  await import("../../src/shared/utils/sidebarRouteMatch.ts");

describe("matchesSidebarHref", () => {
  it("should return false for null/undefined pathname", () => {
    assert.strictEqual(matchesSidebarHref(null, "/dashboard"), false);
    assert.strictEqual(matchesSidebarHref(undefined, "/dashboard"), false);
  });

  it("should match exact pathname when exact=false", () => {
    assert.strictEqual(matchesSidebarHref("/dashboard", "/dashboard"), true);
  });

  it("should match nested routes when exact=false", () => {
    assert.strictEqual(matchesSidebarHref("/dashboard/cache", "/dashboard"), true);
    assert.strictEqual(matchesSidebarHref("/dashboard/cache/media", "/dashboard"), true);
  });

  it("should not match unrelated routes", () => {
    assert.strictEqual(matchesSidebarHref("/settings", "/dashboard"), false);
    assert.strictEqual(matchesSidebarHref("/dashboardx", "/dashboard"), false);
  });

  it("should respect exact match flag", () => {
    assert.strictEqual(matchesSidebarHref("/dashboard", "/dashboard", true), true);
    assert.strictEqual(matchesSidebarHref("/dashboard/cache", "/dashboard", true), false);
  });

  it("should handle trailing slashes correctly", () => {
    // Both '/dashboard/' and '/dashboard' normalize to '/dashboard'
    assert.strictEqual(matchesSidebarHref("/dashboard/", "/dashboard"), true);
    // '/dashboard/cache' matches '/dashboard/' because after normalization it's '/dashboard/cache' starts with '/dashboard/'
    assert.strictEqual(matchesSidebarHref("/dashboard/cache", "/dashboard/"), true);
  });
});

describe("getActiveSidebarHref", () => {
  it("should return null for null/undefined pathname", () => {
    const items = [{ href: "/dashboard" }];
    assert.strictEqual(getActiveSidebarHref(null, items), null);
    assert.strictEqual(getActiveSidebarHref(undefined, items), null);
  });

  it("should return null when no items match", () => {
    const items = [{ href: "/dashboard" }, { href: "/settings" }];
    assert.strictEqual(getActiveSidebarHref("/other", items), null);
  });

  it("should return matching href", () => {
    const items = [{ href: "/dashboard" }, { href: "/settings" }];
    assert.strictEqual(getActiveSidebarHref("/dashboard", items), "/dashboard");
  });

  it("should ignore external links", () => {
    const items = [{ href: "https://example.com", external: true }, { href: "/dashboard" }];
    assert.strictEqual(getActiveSidebarHref("/dashboard", items), "/dashboard");
  });

  it("should return longest matching href", () => {
    const items = [
      { href: "/dashboard" },
      { href: "/dashboard/cache" },
      { href: "/dashboard/cache/media" },
    ];
    assert.strictEqual(
      getActiveSidebarHref("/dashboard/cache/media", items),
      "/dashboard/cache/media"
    );
    assert.strictEqual(
      getActiveSidebarHref("/dashboard/cache/media/files", items),
      "/dashboard/cache/media"
    );
    assert.strictEqual(getActiveSidebarHref("/dashboard/cache", items), "/dashboard/cache");
    assert.strictEqual(getActiveSidebarHref("/dashboard/other", items), "/dashboard");
  });

  it("should prefer exact match over longer non-exact match", () => {
    const items = [
      { href: "/dashboard", exact: false },
      { href: "/dashboard/cache", exact: true },
    ];
    assert.strictEqual(getActiveSidebarHref("/dashboard/cache", items), "/dashboard/cache");
    assert.strictEqual(getActiveSidebarHref("/dashboard/cache/media", items), "/dashboard");
  });

  it("should handle mixed exact and non-exact items", () => {
    const items = [
      { href: "/", exact: true },
      { href: "/dashboard" },
      { href: "/settings", exact: true },
    ];
    assert.strictEqual(getActiveSidebarHref("/", items), "/");
    assert.strictEqual(getActiveSidebarHref("/dashboard", items), "/dashboard");
    assert.strictEqual(getActiveSidebarHref("/dashboard/cache", items), "/dashboard");
    assert.strictEqual(getActiveSidebarHref("/settings", items), "/settings");
    assert.strictEqual(getActiveSidebarHref("/settings/profile", items), null);
  });

  it("should handle real-world sidebar scenario", () => {
    const items = [
      { href: "/dashboard", icon: "dashboard" },
      { href: "/dashboard/cache", icon: "storage" },
      { href: "/dashboard/models", icon: "model_training" },
      { href: "/dashboard/logs", icon: "description" },
      { href: "/settings", icon: "settings" },
    ];

    // Test nested cache routes
    assert.strictEqual(getActiveSidebarHref("/dashboard/cache", items), "/dashboard/cache");
    assert.strictEqual(getActiveSidebarHref("/dashboard/cache/media", items), "/dashboard/cache");
    assert.strictEqual(
      getActiveSidebarHref("/dashboard/cache/media/files", items),
      "/dashboard/cache"
    );

    // Test other dashboard routes
    assert.strictEqual(getActiveSidebarHref("/dashboard/models", items), "/dashboard/models");
    assert.strictEqual(getActiveSidebarHref("/dashboard/logs", items), "/dashboard/logs");

    // Test fallback to parent
    assert.strictEqual(getActiveSidebarHref("/dashboard/other", items), "/dashboard");

    // Test settings
    assert.strictEqual(getActiveSidebarHref("/settings", items), "/settings");
    assert.strictEqual(getActiveSidebarHref("/settings/profile", items), "/settings");
  });

  it("should handle empty items array", () => {
    assert.strictEqual(getActiveSidebarHref("/dashboard", []), null);
  });

  it("should handle items with only external links", () => {
    const items = [
      { href: "https://example.com", external: true },
      { href: "https://docs.example.com", external: true },
    ];
    assert.strictEqual(getActiveSidebarHref("/dashboard", items), null);
  });
});
