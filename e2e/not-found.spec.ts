import { test, expect } from "@playwright/test";

test.describe("unknown slugs return a 404 page", () => {
  test("unknown product slug", async ({ page }) => {
    const response = await page.goto("/products/this-product-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /product not found|404/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /go home/i })).toBeVisible();
  });

  test("unknown category slug", async ({ page }) => {
    const response = await page.goto("/category/not-a-real-category");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /not found|404/i }).first()).toBeVisible();
  });

  test("unknown route", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });
});
