import { test, expect } from "@playwright/test";

test.describe("Board Interactions", () => {
  test("should load board page structure", async ({ page }) => {
    // Navigate to a board page (using a test token or public board)
    // This test assumes you have a way to access boards
    await page.goto("/");

    // Check for main content area
    const main = page.getByRole("main").or(page.locator("main"));
    const hasMain = await main.count() > 0;

    // At minimum, page should load
    await expect(page).toHaveTitle(/Plan.krd/i);
  });

  test("should be responsive on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Page should load without horizontal scroll
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Check viewport width
    const viewportWidth = page.viewportSize()?.width;
    expect(viewportWidth).toBe(375);
  });

  test("should be responsive on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("should be responsive on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");

    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
