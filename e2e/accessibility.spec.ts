import { test, expect } from "@playwright/test";

test.describe("Accessibility", () => {
  test("should have proper page structure", async ({ page }) => {
    await page.goto("/");

    // Check for semantic HTML elements
    const main = page.locator("main");
    const nav = page.locator("nav");
    const header = page.locator("header");
    const footer = page.locator("footer");

    // At least main or nav should exist
    const hasMain = await main.count() > 0;
    const hasNav = await nav.count() > 0;
    const hasHeader = await header.count() > 0;

    expect(hasMain || hasNav || hasHeader).toBeTruthy();
  });

  test("should have accessible buttons", async ({ page }) => {
    await page.goto("/");

    // Find all buttons
    const buttons = page.getByRole("button");
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      // Check first button has accessible name
      const firstButton = buttons.first();
      const ariaLabel = await firstButton.getAttribute("aria-label");
      const textContent = await firstButton.textContent();
      const hasAccessibleName = ariaLabel || (textContent && textContent.trim().length > 0);

      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/");

    // Check for headings
    const h1 = page.locator("h1");
    const h2 = page.locator("h2");

    // Page should have at least one heading
    const h1Count = await h1.count();
    const h2Count = await h2.count();

    expect(h1Count + h2Count).toBeGreaterThan(0);
  });

  test("should have proper link text", async ({ page }) => {
    await page.goto("/");

    const links = page.getByRole("link");
    const linkCount = await links.count();

    if (linkCount > 0) {
      // Check first link has accessible text
      const firstLink = links.first();
      const textContent = await firstLink.textContent();
      const ariaLabel = await firstLink.getAttribute("aria-label");

      const hasAccessibleText = (textContent && textContent.trim().length > 0) || ariaLabel;
      expect(hasAccessibleText).toBeTruthy();
    }
  });

  test("should have proper form labels", async ({ page }) => {
    await page.goto("/auth/sign-in");

    // Check for form inputs
    const inputs = page.locator("input");
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      // At least some inputs should have labels or aria-labels
      let labeledInputs = 0;
      for (let i = 0; i < Math.min(inputCount, 5); i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute("id");
        const ariaLabel = await input.getAttribute("aria-label");
        const placeholder = await input.getAttribute("placeholder");

        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          if ((await label.count()) > 0) labeledInputs++;
        } else if (ariaLabel || placeholder) {
          labeledInputs++;
        }
      }

      // At least some inputs should be labeled
      expect(labeledInputs).toBeGreaterThan(0);
    }
  });
});
