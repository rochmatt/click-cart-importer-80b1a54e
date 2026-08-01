import { products, type Product } from "@/data/products";

export interface CategoryInfo {
  slug: string;
  label: string;
  blurb: string;
  subcategories: string[];
}

export const categoryCatalog: CategoryInfo[] = [
  {
    slug: "fashion",
    label: "Fashion",
    blurb: "Sneakers, bags and everyday accessories from curated sellers.",
    subcategories: ["Sneakers", "Tas & Dompet", "Pakaian Pria", "Pakaian Wanita", "Jam & Aksesori"],
  },
  {
    slug: "electronics",
    label: "Electronics",
    blurb: "Audio, wearables and gadgets with verified marketplace pricing.",
    subcategories: ["Audio & Headphone", "Smartwatch", "Smartphone", "Laptop & Tablet", "Aksesori Gadget"],
  },
  {
    slug: "home-living",
    label: "Home & Living",
    blurb: "Lighting, decor and furniture picks for a warmer space.",
    subcategories: ["Lampu & Pencahayaan", "Dekorasi", "Furnitur", "Perlengkapan Tidur", "Penyimpanan"],
  },
  {
    slug: "beauty",
    label: "Beauty",
    blurb: "Skincare and makeup best-sellers loved by Indonesian shoppers.",
    subcategories: ["Skincare", "Makeup", "Parfum", "Perawatan Tubuh", "Perawatan Rambut"],
  },
  {
    slug: "sports",
    label: "Sports",
    blurb: "Training gear and outdoor essentials for every routine.",
    subcategories: ["Fitness & Gym", "Sepatu Olahraga", "Outdoor & Hiking", "Sepeda", "Yoga"],
  },
  {
    slug: "kids",
    label: "Kids",
    blurb: "Baby care, kids fashion and learning toys.",
    subcategories: ["Perlengkapan Bayi", "Pakaian Anak", "Mainan Edukasi", "Stroller & Car Seat", "Sekolah"],
  },
  {
    slug: "gaming",
    label: "Gaming",
    blurb: "Consoles, PC gear and collectibles for players.",
    subcategories: ["Konsol", "PC Gaming", "Controller", "Headset Gaming", "Koleksi & Figur"],
  },
  {
    slug: "kitchen",
    label: "Kitchen",
    blurb: "Cookware, appliances and dining essentials.",
    subcategories: ["Peralatan Masak", "Alat Elektronik Dapur", "Peralatan Makan", "Penyimpanan Makanan", "Kopi & Teh"],
  },
];


export const categorySlug = (label: string) =>
  label.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function findCategory(slug: string): CategoryInfo | undefined {
  return categoryCatalog.find((c) => c.slug === slug);
}

export function productsInCategory(label: string): Product[] {
  return products.filter((p) => p.category === label);
}
