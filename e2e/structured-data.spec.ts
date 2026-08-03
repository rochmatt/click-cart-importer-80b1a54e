import { test, expect, type Page } from "@playwright/test";

async function jsonLd(page: Page) {
  const blobs = await page.$$eval('script[type="application/ld+json"]', (els) =>
    els.map((el) => el.textContent ?? ""),
  );
  return blobs.map((raw) => JSON.parse(raw) as Record<string, unknown>);
}

const typeOf = (items: Record<string, unknown>[], type: string) =>
  items.find((item) => item["@type"] === type);

test.describe("schema.org structured data", () => {
  test("home page exposes Organization and WebSite", async ({ page }) => {
    await page.goto("/");
    const items = await jsonLd(page);

    const org = typeOf(items, "Organization");
    expect(org).toBeTruthy();
    expect(org!.name).toBe("PasarPilih");

    const site = typeOf(items, "WebSite");
    expect(site).toBeTruthy();
    expect(site!.potentialAction).toBeTruthy();
  });

  test("product page exposes Product with offer and breadcrumbs", async ({ page }) => {
    await page.goto("/products/1");
    const items = await jsonLd(page);

    const product = typeOf(items, "Product") as
      { name: string; offers: { price?: string; priceCurrency?: string } } | undefined;
    expect(product).toBeTruthy();
    expect(product!.name.length).toBeGreaterThan(0);
    expect(product!.offers.priceCurrency).toBe("IDR");
    expect(product!.offers.price).toMatch(/^\d+$/);

    const reviews = (
      product as unknown as {
        review?: {
          "@type": string;
          author: { name: string };
          reviewRating: { ratingValue: number };
        }[];
      }
    ).review;
    expect(reviews?.length).toBeGreaterThan(0);
    expect(reviews![0]["@type"]).toBe("Review");
    expect(reviews![0].author.name.length).toBeGreaterThan(0);
    expect(reviews![0].reviewRating.ratingValue).toBeGreaterThan(0);

    const crumbs = typeOf(items, "BreadcrumbList") as
      { itemListElement: { position: number; name: string }[] } | undefined;
    expect(crumbs).toBeTruthy();
    expect(crumbs!.itemListElement).toHaveLength(3);
    expect(crumbs!.itemListElement[0].name).toBe("Home");
  });

  test("category page exposes BreadcrumbList", async ({ page }) => {
    await page.goto("/category/fashion");
    const items = await jsonLd(page);

    const crumbs = typeOf(items, "BreadcrumbList") as
      { itemListElement: { name: string; item: string }[] } | undefined;
    expect(crumbs).toBeTruthy();
    expect(crumbs!.itemListElement.at(-1)).toMatchObject({
      name: "Fashion",
      item: "/category/fashion",
    });
  });
});
