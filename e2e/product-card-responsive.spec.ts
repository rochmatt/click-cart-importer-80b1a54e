import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Responsive guardrails for the product card: badges, wishlist and the CTA must
 * stay inside the card, never overlap, leave no awkward empty space, and every
 * card in a row must have the same height.
 */

const WIDTHS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-414", width: 414, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 900 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "desktop-1536", width: 1536, height: 960 },
];

// Max vertical gap allowed between two stacked blocks inside the card body.
const MAX_INNER_GAP = 16;
// Max distance between the last block and the card bottom (padding only).
const MAX_BOTTOM_SLACK = 20;

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


/** Measures the vertical gaps between the card body's direct blocks. */
async function bodyMetrics(card: Locator) {
  return card.evaluate((el) => {
    const body = el.querySelector("a > div:nth-child(2)")!;
    const rects = [...body.children].map((child) => child.getBoundingClientRect());
    const gaps: number[] = [];
    for (let i = 0; i < rects.length - 1; i += 1) {
      gaps.push(rects[i + 1]!.top - rects[i]!.bottom);
    }
    const cardRect = el.getBoundingClientRect();
    const last = rects[rects.length - 1]!;
    return { gaps, bottomSlack: cardRect.bottom - last.bottom, blocks: rects.length };
  });
}

async function firstCard(page: Page) {
  const card = page.locator("article:has(a[href^='/products/'])").first();
  await expect(card).toBeVisible();
  return card;
}

function ctaOf(card: Locator) {
  return card
    .locator("button[aria-label*='Quick view' i]")
    .or(card.getByText(/view product/i))
    .first();
}

test.describe("ProductCard responsive layout", () => {
  // Layout only depends on viewport width, so run this once (desktop project).
  test.skip(
    ({}, testInfo) => testInfo.project.name !== "desktop",
    "viewport-driven layout check runs once",
  );

  for (const size of WIDTHS) {
    test(`no overlap at ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/");

      const card = await firstCard(page);
      await card.scrollIntoViewIfNeeded();

      const cardBox = await boxOf(card);
      const title = card.getByRole("heading");
      const wishlist = card.getByRole("button", { name: /wishlist/i });
      const cta = ctaOf(card);

      const titleBox = await boxOf(title);
      const wishlistBox = await boxOf(wishlist);
      const ctaBox = await boxOf(cta);

      // Quick add stepper was removed from the card — it must not come back.
      await expect(
        card.locator("button[aria-label*='keranjang' i]"),
        `quick add stepper should not exist at ${size.name}`,
      ).toHaveCount(0);

      // Everything stays inside the card.
      for (const [label, box] of [
        ["title", titleBox],
        ["wishlist", wishlistBox],
        ["cta", ctaBox],
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

      // CTA sits below the title block and never collides with it.
      expect(ctaBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 2);
      expect(overlaps(ctaBox, titleBox), `cta overlaps title at ${size.name}`).toBe(false);
      expect(
        overlaps(ctaBox, wishlistBox),
        `cta overlaps wishlist at ${size.name}`,
      ).toBe(false);

      // No dead space: blocks are packed and the CTA hugs the bottom padding.
      const metrics = await bodyMetrics(card);
      expect(metrics.blocks, `unexpected card body structure at ${size.name}`).toBe(5);
      // The last gap is the flexible spacer that bottom-aligns the CTA across a row.
      for (const gap of metrics.gaps.slice(0, -1)) {
        expect(
          gap,
          `empty space inside the card at ${size.name} (gaps ${metrics.gaps.join("/")})`,
        ).toBeLessThanOrEqual(MAX_INNER_GAP);
        expect(gap, `blocks collide at ${size.name}`).toBeGreaterThanOrEqual(0);
      }
      expect(
        metrics.gaps[metrics.gaps.length - 1]!,
        `cta collides with the price row at ${size.name}`,
      ).toBeGreaterThanOrEqual(0);
      if (false) {
      }
      expect(
        metrics.bottomSlack,
        `too much empty space below the cta at ${size.name} (${metrics.bottomSlack}px)`,
      ).toBeLessThanOrEqual(MAX_BOTTOM_SLACK);
      expect(metrics.bottomSlack, `cta clipped at ${size.name}`).toBeGreaterThanOrEqual(0);

      // Badges (when present) never sit on top of the title or cta.
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
        expect(overlaps(badgeBox, ctaBox), `badge ${i} overlaps cta at ${size.name}`).toBe(
          false,
        );
      }

      // Cards on the same row must all be the same height.
      const list = page.locator("article:has(a[href^='/products/'])");
      const total = Math.min(await list.count(), 8);
      const rows = new Map<number, number[]>();
      for (let i = 0; i < total; i += 1) {
        await list.nth(i).scrollIntoViewIfNeeded();
        const box = await boxOf(list.nth(i));
        const rowKey = Math.round(box.y / 8);
        const existing = [...rows.keys()].find((key) => Math.abs(key - rowKey) <= 2);
        const key = existing ?? rowKey;
        rows.set(key, [...(rows.get(key) ?? []), box.height]);
      }
      for (const [rowKey, heights] of rows) {
        const spread = Math.max(...heights) - Math.min(...heights);
        expect(
          spread,
          `card heights differ in row ${rowKey} at ${size.name} (${heights.join("/")})`,
        ).toBeLessThanOrEqual(1);
      }

      await card.scrollIntoViewIfNeeded();
      const shotBox = await boxOf(card);
      await page.screenshot({
        path: `test-results/product-card-${size.name}.png`,
        clip: {
          x: Math.max(0, shotBox.x - 8),
          y: Math.max(0, shotBox.y - 8),
          width: Math.min(size.width, shotBox.width + 16),
          height: shotBox.height + 16,
        },
      });
    });
  }
});
