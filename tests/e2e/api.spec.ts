import { test, expect } from "@playwright/test";

/** Management API Bearer key (registered in dashboard API keys). Required when login is enabled. */
const MANAGEMENT_API_KEY = process.env.ROUTIFORM_API_KEY?.trim() || "";

test.describe("API Health Checks", () => {
  test("GET /api/monitoring/health returns OK", async ({ request }) => {
    const res = await request.get("/api/monitoring/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("status");
  });

  test("GET /api/v1/models returns model list", async ({ request }) => {
    const res = await request.get("/api/v1/models");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /api/providers returns provider list", async ({ request }) => {
    const res = await request.get("/api/providers", {
      headers: MANAGEMENT_API_KEY ? { Authorization: `Bearer ${MANAGEMENT_API_KEY}` } : {},
    });
    if (res.status() === 401 && !MANAGEMENT_API_KEY) {
      test.skip(
        true,
        "Management APIs require auth when login is enabled. Run with ROUTIFORM_API_KEY set to a valid dashboard API key."
      );
    }
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("connections");
    expect(Array.isArray(body.connections)).toBe(true);
  });
});
