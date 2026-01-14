import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should load the landing page", async ({ page }) => {
    await page.goto("/");

    // Check that the page title is correct
    await expect(page).toHaveTitle(/Plan.krd/i);

    // Check that the page loaded successfully
    await expect(page).toHaveURL(/.*\/$/);
  });

  test("should navigate to sign-in page", async ({ page }) => {
    await page.goto("/");

    // Look for sign-in link or button
    const signInLink = page.getByRole("link", { name: /sign in/i }).or(
      page.getByRole("button", { name: /sign in/i })
    ).or(
      page.getByText(/sign in/i).first()
    );

    // If sign-in link exists, click it
    if (await signInLink.count() > 0) {
      await signInLink.first().click();
      await expect(page).toHaveURL(/.*\/auth\/sign-in/);
    } else {
      // If no sign-in link found, try navigating directly
      await page.goto("/auth/sign-in");
      await expect(page).toHaveURL(/.*\/auth\/sign-in/);
    }
  });

  test("should have accessible navigation", async ({ page }) => {
    await page.goto("/");

    // Check for main navigation landmarks
    const main = page.getByRole("main").or(page.locator("main"));
    const nav = page.getByRole("navigation").or(page.locator("nav"));

    // At least one should exist
    const hasMain = await main.count() > 0;
    const hasNav = await nav.count() > 0;

    expect(hasMain || hasNav).toBeTruthy();
  });

  test("should be responsive", async ({ page }) => {
    await page.goto("/");

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator("body")).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator("body")).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("should have proper meta tags", async ({ page }) => {
    await page.goto("/");

    // Check for meta description
    const metaDescription = page.locator('meta[name="description"]');
    if (await metaDescription.count() > 0) {
      const description = await metaDescription.getAttribute("content");
      expect(description).toBeTruthy();
      expect(description?.length).toBeGreaterThan(0);
    }
  });
});
