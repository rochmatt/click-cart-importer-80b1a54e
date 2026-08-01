import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Narrow-viewport guardrails for the product card (320-430px).
 * Badges, wishlist, quick add stepper and quick view must stay inside the card
 * and never overlap, even on the smallest phones still in use.
 */

const NARROW_WIDTHS = [
  { name: "w320", width: 320 }, // iPhone SE (1st gen) / smallest Android
  { name: "w360", width: 360 }, // Galaxy A-series
  { name: "w375", width: 375 }, // iPhone SE 2/3, iPhone 13 mini
  { name: "w390", width: 390 }, // iPhone 13/14
  { name: "w414", width: 414 }, // iPhone Plus
  { name: "w430", width: 430 }, // iPhone Pro Max
];

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator, label: string): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `${label} should be laid out`).not.toBeNull();
  return box!;
}

function overlaps(a: Box, b: Box, tolerance = 1) {
  return (
    a.x + a.width - tolerance > b.x &&
    b.x + b.width - tolerance > a.x &&
    a.y + a.height - tolerance > b.y &&
    b.y + b.height - tolerance > a.y
  );
}

function contains(outer: Box, inner: Box, tolerance = 2) {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

async function cards(page: Page) {
  const list = page.locator("article:has(a[href^='/products/'])");
  await expect(list.first()).toBeVisible();
  return list;
}

test.describe("ProductCard narrow viewports", () => {
  // Layout depends on viewport width only, so run this once (mobile project).
  test.skip(
    ({}, testInfo) => testInfo.project.name !== "mobile",
    "narrow-viewport layout check runs once",
  );

  for (const size of NARROW_WIDTHS) {
    test(`badge, wishlist, quick add and quick view stay clear at ${size.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: 900 });
      await page.goto("/");

      const list = await cards(page);
      // Check several cards so sale/stock badge variants are covered.
      const total = Math.min(await list.count(), 6);
      expect(total).toBeGreaterThan(0);

      for (let index = 0; index < total; index += 1) {
        const card = list.nth(index);
        await card.scrollIntoViewIfNeeded();

        const at = `${size.name} card ${index}`;
        const cardBox = await boxOf(card, `card ${index}`);
        const titleBox = await boxOf(card.getByRole("heading"), "title");
        const wishlistBox = await boxOf(
          card.locator("button[aria-label*='wishlist' i]").first(),
          "wishlist",
        );
        const stepperBox = await boxOf(
          card
            .locator("button[aria-label*='keranjang' i], button[aria-label*='habis' i]")
            .first(),
          "quick add",
        );

        // No horizontal overflow: the card itself must fit the viewport.
        expect(cardBox.x, `card overflows left at ${at}`).toBeGreaterThanOrEqual(-1);
        expect(
          cardBox.x + cardBox.width,
          `card overflows right at ${at}`,
        ).toBeLessThanOrEqual(size.width + 1);

        for (const [label, box] of [
          ["title", titleBox],
          ["wishlist", wishlistBox],
          ["quick add", stepperBox],
        ] as const) {
          expect(contains(cardBox, box), `${label} escapes card at ${at}`).toBe(true);
        }

        expect(overlaps(titleBox, wishlistBox), `title hits wishlist at ${at}`).toBe(
          false,
        );
        expect(overlaps(stepperBox, wishlistBox), `quick add hits wishlist at ${at}`).toBe(
          false,
        );
        expect(overlaps(stepperBox, titleBox), `quick add hits title at ${at}`).toBe(
          false,
        );

        // Badges (Sale / Best Seller / Stok menipis / Habis) sit above the title.
        const badges = card.locator("span.rounded-full.uppercase");
        const badgeCount = await badges.count();
        for (let b = 0; b < badgeCount; b += 1) {
          const badgeBox = await boxOf(badges.nth(b), `badge ${b}`);
          expect(contains(cardBox, badgeBox), `badge ${b} escapes card at ${at}`).toBe(
            true,
          );
          expect(overlaps(badgeBox, titleBox), `badge ${b} hits title at ${at}`).toBe(
            false,
          );
          expect(
            overlaps(badgeBox, wishlistBox),
            `badge ${b} hits wishlist at ${at}`,
          ).toBe(false);
          expect(
            overlaps(badgeBox, stepperBox),
            `badge ${b} hits quick add at ${at}`,
          ).toBe(false);
          for (let other = b + 1; other < badgeCount; other += 1) {
            const otherBox = await boxOf(badges.nth(other), `badge ${other}`);
            expect(
              overlaps(badgeBox, otherBox),
              `badge ${b} hits badge ${other} at ${at}`,
            ).toBe(false);
          }
        }

        // Secondary CTA (quick view button or the "View Product" pill).
        const cta = card
          .locator("button[aria-label*='Quick view' i]")
          .or(card.getByText(/view product/i))
          .first();
        if (await cta.count()) {
          const ctaBox = await boxOf(cta, "cta");
          expect(contains(cardBox, ctaBox), `quick view escapes card at ${at}`).toBe(true);
          expect(
            overlaps(ctaBox, stepperBox),
            `quick view hits quick add at ${at}`,
          ).toBe(false);
          expect(overlaps(ctaBox, titleBox), `quick view hits title at ${at}`).toBe(
            false,
          );
        }

        // Tap targets stay usable on the narrowest phones.
        expect(wishlistBox.width, `wishlist too small at ${at}`).toBeGreaterThanOrEqual(
          28,
        );
        expect(stepperBox.height, `quick add too short at ${at}`).toBeGreaterThanOrEqual(
          18,
        );
      }

      const firstBox = await boxOf(list.first(), "first card");
      await page.screenshot({
        path: `test-results/product-card-narrow-${size.name}.png`,
        clip: {
          x: Math.max(0, firstBox.x - 6),
          y: Math.max(0, firstBox.y - 6),
          width: Math.min(size.width, firstBox.width + 12),
          height: firstBox.height + 12,
        },
      });
    });
  }
});
