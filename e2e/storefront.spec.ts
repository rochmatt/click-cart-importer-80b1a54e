import { test, expect } from "@playwright/test";

test.describe("storefront", () => {
  test("home page renders hero, catalog and branded metadata", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/PasarPilih/i);
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute("content", /.{40,}/);
    await expect(description).not.toHaveAttribute("content", /Lovable Generated Project/i);

    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("link", { name: /track order|help/i }).first()).toBeVisible();
  });

  test("search page keeps the query in the URL", async ({ page }) => {
    await page.goto("/search?q=iphone");
    await expect(page).toHaveURL(/q=iphone/);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("category page renders its own title", async ({ page }) => {
    await page.goto("/");
    const categoryLink = page.locator('a[href^="/category/"]').first();
    await categoryLink.waitFor();
    const href = await categoryLink.getAttribute("href");
    await page.goto(href!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/PasarPilih/i);
  });
});
