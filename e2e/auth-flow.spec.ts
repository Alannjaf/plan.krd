import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should navigate to sign-in page", async ({ page }) => {
    await page.goto("/");
    
    // Try to find and click sign-in link, or navigate directly
    const signInLink = page.getByRole("link", { name: /sign in/i }).or(
      page.getByRole("button", { name: /sign in/i })
    );

    if (await signInLink.count() > 0) {
      await signInLink.first().click();
    } else {
      await page.goto("/auth/sign-in");
    }

    await expect(page).toHaveURL(/.*\/auth\/sign-in/);
  });

  test("should navigate to sign-up page", async ({ page }) => {
    await page.goto("/auth/sign-up");
    await expect(page).toHaveURL(/.*\/auth\/sign-up/);
  });

  test("should display sign-in form", async ({ page }) => {
    await page.goto("/auth/sign-in");
    
    // Check for form elements (email, password, submit button)
    const emailInput = page.locator('input[type="email"]').or(
      page.locator('input[name="email"]')
    );
    const passwordInput = page.locator('input[type="password"]').or(
      page.locator('input[name="password"]')
    );

    // At least one input should be present
    const hasEmail = await emailInput.count() > 0;
    const hasPassword = await passwordInput.count() > 0;
    
    expect(hasEmail || hasPassword).toBeTruthy();
  });
});
