import { products, type Product } from "@/data/products";

export interface CategoryInfo {
  slug: string;
  label: string;
  blurb: string;
}

export const categoryCatalog: CategoryInfo[] = [
  { slug: "fashion", label: "Fashion", blurb: "Sneakers, bags and everyday accessories from curated sellers." },
  { slug: "electronics", label: "Electronics", blurb: "Audio, wearables and gadgets with verified marketplace pricing." },
  { slug: "home-living", label: "Home & Living", blurb: "Lighting, decor and furniture picks for a warmer space." },
  { slug: "beauty", label: "Beauty", blurb: "Skincare and makeup best-sellers loved by Indonesian shoppers." },
  { slug: "sports", label: "Sports", blurb: "Training gear and outdoor essentials for every routine." },
  { slug: "kids", label: "Kids", blurb: "Baby care, kids fashion and learning toys." },
  { slug: "gaming", label: "Gaming", blurb: "Consoles, PC gear and collectibles for players." },
  { slug: "kitchen", label: "Kitchen", blurb: "Cookware, appliances and dining essentials." },
];

export const categorySlug = (label: string) =>
  label.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function findCategory(slug: string): CategoryInfo | undefined {
  return categoryCatalog.find((c) => c.slug === slug);
}

export function productsInCategory(label: string): Product[] {
  return products.filter((p) => p.category === label);
}
