import { test, expect, type Page } from "@playwright/test";

/** Opens a settings tab via query (tab labels are icon-only below `sm`, so clicking by name is flaky). */
async function openSettingsTab(page: Page, tab: string) {
  await page.goto(`/dashboard/settings?tab=${tab}`);
  await page.waitForLoadState("networkidle");
}

test.describe("Settings Toggles", () => {
  test("Debug mode toggle should work", async ({ page }) => {
    await openSettingsTab(page, "advanced");
    const redirectedToLogin = page.url().includes("/login");
    test.skip(redirectedToLogin, "Authentication enabled without a login fixture.");

    const debugToggle = page.getByRole("switch").first();

    await expect(debugToggle).toBeVisible({ timeout: 5000 });

    const initialState = await debugToggle.getAttribute("aria-checked");
    await debugToggle.click();
    await expect(debugToggle).toHaveAttribute(
      "aria-checked",
      initialState === "true" ? "false" : "true",
      { timeout: 5000 }
    );
  });

  test("Sidebar visibility toggle should work", async ({ page }) => {
    await openSettingsTab(page, "appearance");
    const redirectedToLogin = page.url().includes("/login");
    test.skip(redirectedToLogin, "Authentication enabled without a login fixture.");

    const sidebarToggle = page.getByRole("switch").first();

    await expect(sidebarToggle).toBeVisible({ timeout: 5000 });

    const initialState = await sidebarToggle.getAttribute("aria-checked");
    await sidebarToggle.click();
    await expect(sidebarToggle).toHaveAttribute(
      "aria-checked",
      initialState === "true" ? "false" : "true",
      { timeout: 5000 }
    );
  });

  test("Clear Cache button calls DELETE /api/cache", async ({ page }) => {
    await openSettingsTab(page, "general");
    const redirectedToLogin = page.url().includes("/login");
    test.skip(redirectedToLogin, "Authentication enabled without a login fixture.");

    const clearBtn = page.getByRole("button", { name: /clear cache/i });
    await expect(clearBtn).toBeVisible({ timeout: 5000 });

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/cache") && req.method() === "DELETE"),
      clearBtn.click(),
    ]);
    expect(request).toBeTruthy();
  });

  test("Purge Expired Logs button calls POST /api/settings/purge-logs", async ({ page }) => {
    await openSettingsTab(page, "general");
    const redirectedToLogin = page.url().includes("/login");
    test.skip(redirectedToLogin, "Authentication enabled without a login fixture.");

    const purgeBtn = page.getByRole("button", { name: /purge expired logs/i });
    await expect(purgeBtn).toBeVisible({ timeout: 5000 });

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes("/api/settings/purge-logs") && req.method() === "POST"
      ),
      purgeBtn.click(),
    ]);
    expect(request).toBeTruthy();
  });

  test("Debug mode should persist after page reload", async ({ page }) => {
    await openSettingsTab(page, "advanced");
    const redirectedToLogin = page.url().includes("/login");
    test.skip(redirectedToLogin, "Authentication enabled without a login fixture.");

    const debugToggle = page.getByRole("switch").first();

    await expect(debugToggle).toBeVisible({ timeout: 5000 });

    const initialState = await debugToggle.getAttribute("aria-checked");
    await debugToggle.click();
    const nextState = initialState === "true" ? "false" : "true";
    await expect(debugToggle).toHaveAttribute("aria-checked", nextState, { timeout: 5000 });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.goto("/dashboard/settings?tab=advanced");
    await page.waitForLoadState("networkidle");

    const debugToggleAfterReload = page.getByRole("switch").first();
    await expect(debugToggleAfterReload).toHaveAttribute("aria-checked", nextState, {
      timeout: 5000,
    });
  });
});
