import { test, expect, devices } from "@playwright/test";

test.describe("mobile bottom navigation", () => {
  test.use({ ...devices["Pixel 7"] });

  test("is visible on phones and navigates between sections", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();

    await nav.getByRole("link", { name: "Wishlist" }).click();
    await expect(page).toHaveURL(/\/wishlist/);
    await expect(nav.getByRole("link", { name: "Wishlist" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await nav.getByRole("link", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/search/);

    await nav.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("desktop", () => {
  test.use({ ...devices["Desktop Chrome"] });

  test("bottom nav is hidden on wide viewports", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
  });
});
