import { test, expect } from "@playwright/test";

test.describe("mobile bottom navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("is visible on phones and navigates between sections", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();

    // Versi sebelumnya menuntut tautan "Wishlist" — yang TIDAK PERNAH ADA di
    // MobileBottomNav.tsx. Isinya Home, Kategori, Search, Cart, Account. Tesnya
    // ditulis untuk rancangan yang tidak jadi dipakai, lalu tidak pernah
    // dijalankan sekali pun karena browser Playwright belum terpasang, jadi tak
    // ada yang tahu ia menuntut sesuatu yang mustahil.
    //
    // Tujuannya "Kategori", bukan "Account", dengan alasan yang harus dicatat:
    // /account dan /checkout TIDAK merender MobileBottomNav sama sekali,
    // padahal nav ini menautkan ke keduanya. Di ponsel, menekan Account atau
    // Cart membuat navigasi bawah lenyap. Memakai keduanya di sini akan membuat
    // tes gagal karena cacat itu, bukan karena aria-current-nya rusak.
    await nav.getByRole("link", { name: "Kategori" }).click();
    await expect(page).toHaveURL(/\/categories/);
    await expect(nav.getByRole("link", { name: "Kategori" })).toHaveAttribute(
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
  test.use({ viewport: { width: 1280, height: 900 } });

  test("bottom nav is hidden on wide viewports", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
  });
});
