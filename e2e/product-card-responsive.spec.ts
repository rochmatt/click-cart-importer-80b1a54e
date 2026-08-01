import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Responsive guardrails for the product card: badges, wishlist button and the
 * quick-add stepper must stay inside the card and never overlap each other.
 */

const WIDTHS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-414", width: 414, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 900 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "desktop-1536", width: 1536, height: 960 },
];

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, "element should be laid out").not.toBeNull();
  return box!;
}

function overlaps(a: Box, b: Box, tolerance = 1) {
  const horizontal =
    a.x + a.width - tolerance > b.x && b.x + b.width - tolerance > a.x;
  const vertical =
    a.y + a.height - tolerance > b.y && b.y + b.height - tolerance > a.y;
  return horizontal && vertical;
}

function contains(outer: Box, inner: Box, tolerance = 2) {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

async function firstCard(page: Page) {
  const card = page.locator("article:has(a[href^='/products/'])").first();
  await expect(card).toBeVisible();
  return card;
}

test.describe("ProductCard responsive layout", () => {
  // Layout only depends on viewport width, so run it once per width.
  test.skip(({ browserName }) => browserName !== "chromium", "layout check");

  for (const size of WIDTHS) {
    test(`no overlap at ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");

      const card = await firstCard(page);
      await card.scrollIntoViewIfNeeded();

      const cardBox = await boxOf(card);
      const title = card.getByRole("heading");
      const wishlist = card.getByRole("button", { name: /wishlist/i });
      const stepper = card.getByRole("button", { name: /keranjang|stok habis/i });
      const cta = card.getByRole("button", { name: /quick view/i });

      const titleBox = await boxOf(title);
      const wishlistBox = await boxOf(wishlist);
      const stepperBox = await boxOf(stepper);

      // Everything stays inside the card.
      for (const [label, box] of [
        ["title", titleBox],
        ["wishlist", wishlistBox],
        ["quick add", stepperBox],
      ] as const) {
        expect(contains(cardBox, box), `${label} escapes the card at ${size.name}`).toBe(
          true,
        );
      }

      // Title and wishlist share a row but must not collide.
      expect(
        overlaps(titleBox, wishlistBox),
        `title overlaps wishlist at ${size.name}`,
      ).toBe(false);

      // Quick add sits below the title block.
      expect(stepperBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 2);
      expect(
        overlaps(stepperBox, wishlistBox),
        `quick add overlaps wishlist at ${size.name}`,
      ).toBe(false);

      // Badges (when present) never sit on top of the title.
      const badges = card.locator("span.rounded-full.uppercase");
      const badgeCount = await badges.count();
      for (let i = 0; i < badgeCount; i += 1) {
        const badgeBox = await boxOf(badges.nth(i));
        expect(
          contains(cardBox, badgeBox),
          `badge ${i} escapes the card at ${size.name}`,
        ).toBe(true);
        expect(
          overlaps(badgeBox, titleBox),
          `badge ${i} overlaps title at ${size.name}`,
        ).toBe(false);
        expect(
          overlaps(badgeBox, wishlistBox),
          `badge ${i} overlaps wishlist at ${size.name}`,
        ).toBe(false);
      }

      // Secondary CTA, when rendered as a button, must not collide either.
      if (await cta.count()) {
        const ctaBox = await boxOf(cta.first());
        expect(
          overlaps(ctaBox, stepperBox),
          `quick view overlaps quick add at ${size.name}`,
        ).toBe(false);
        expect(contains(cardBox, ctaBox), `quick view escapes card at ${size.name}`).toBe(
          true,
        );
      }

      await page.screenshot({
        path: `test-results/product-card-${size.name}.png`,
        clip: {
          x: Math.max(0, cardBox.x - 8),
          y: Math.max(0, cardBox.y - 8),
          width: Math.min(size.width, cardBox.width + 16),
          height: cardBox.height + 16,
        },
      });
    });
  }
});
