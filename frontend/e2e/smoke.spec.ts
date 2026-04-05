import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("landing shows hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your Rental Business");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("One Platform");
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  test("skip link targets main landmark", async ({ page }) => {
    await page.goto("/");
    const skip = page.getByRole("link", { name: /skip to main content/i });
    await expect(skip).toHaveAttribute("href", "#main-content");
  });
});
