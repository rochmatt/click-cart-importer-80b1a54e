import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { products as catalogSeed, type Product } from "@/data/products";

type Row = {
  id: string;
  catalog_ref: string | null;
  title: string;
  category: string;
  description: string;
  images: string[] | null;
  price: number;
  sale_price: number | null;
  stock: number;
  rating: number | null;
  reviews: number | null;
  brand: string | null;
  weight: string | null;
  dimensions: string | null;
  warranty_status: string | null;
  warranty_duration: string | null;
  custom_attributes: unknown;
  links: unknown;
};

function idr(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

const defaultLinks = {
  shopee: "https://shopee.co.id",
  tokopedia: "https://www.tokopedia.com",
  tiktok: "https://www.tiktok.com/shop",
};

function specsFrom(row: Row): string[] {
  const out: string[] = [];
  if (row.brand) out.push(`Brand: ${row.brand}`);
  if (row.weight) out.push(`Weight: ${row.weight}`);
  if (row.dimensions) out.push(`Dimensions: ${row.dimensions}`);
  if (row.warranty_status && row.warranty_status !== "none") {
    out.push(`Warranty: ${row.warranty_duration || row.warranty_status}`);
  }
  return out;
}

function detailedSpecsFrom(row: Row): { label: string; value: string }[] {
  const attrs = Array.isArray(row.custom_attributes)
    ? (row.custom_attributes as { name?: string; value?: string }[])
    : [];
  return attrs
    .filter((a) => a?.name && a?.value)
    .map((a) => ({ label: String(a.name), value: String(a.value) }));
}

function toProduct(row: Row, seed?: Product): Product {
  const price = row.sale_price ?? row.price;
  const images = row.images?.length ? row.images : (seed?.images ?? []);
  return {
    id: seed?.id ?? row.id,
    title: row.title || seed?.title || "Untitled product",
    category: row.category || seed?.category || "Fashion",
    price: idr(price),
    oldPrice: row.sale_price && row.price > row.sale_price ? idr(row.price) : seed?.oldPrice,
    rating: Number(row.rating ?? seed?.rating ?? 4.7),
    reviews: row.reviews ?? seed?.reviews ?? 0,
    stock: row.stock ?? seed?.stock ?? 0,
    sold: seed?.sold ?? 0,
    images,
    links: (row.links as Product["links"]) ?? seed?.links ?? defaultLinks,
    description: row.description || seed?.description || "",
    specs: specsFrom(row).length ? specsFrom(row) : (seed?.specs ?? []),
    detailedSpecs: detailedSpecsFrom(row).length
      ? detailedSpecsFrom(row)
      : seed?.detailedSpecs,
  };
}

const COLUMNS =
  "id, catalog_ref, title, category, description, images, price, sale_price, stock, rating, reviews, brand, weight, dimensions, warranty_status, warranty_duration, custom_attributes, links";

async function fetchLiveProducts(): Promise<Row[]> {
  const { data, error } = await supabase
    .from("admin_products")
    .select(COLUMNS)
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Row[];
}

/**
 * The storefront catalog: seed products enriched/overridden by anything the
 * merchant publishes in the admin dashboard, plus admin-only new products.
 */
export function useCatalog() {
  const query = useQuery({
    queryKey: ["storefront-catalog"],
    queryFn: fetchLiveProducts,
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const rows = query.data ?? [];
    const bySeed = new Map<string, Row>();
    const extras: Row[] = [];
    for (const row of rows) {
      if (row.catalog_ref) bySeed.set(row.catalog_ref, row);
      else extras.push(row);
    }
    const merged = catalogSeed.map((seed) => {
      const row = bySeed.get(seed.id);
      return row ? toProduct(row, seed) : seed;
    });
    return [...extras.map((row) => toProduct(row)), ...merged];
  }, [query.data]);

  return { products: items, isLoading: query.isLoading, error: query.error };
}

export function useCatalogProduct(id: string) {
  const { products, isLoading } = useCatalog();
  const product = products.find((p) => p.id === id) ?? null;
  return { product, isLoading };
}

/** Stock levels published by the admin, keyed by storefront product id. */
export function useStockLevels() {
  const query = useQuery({
    queryKey: ["storefront-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_products")
        .select("id, catalog_ref, stock")
        .eq("status", "active");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) map[row.catalog_ref || row.id] = row.stock ?? 0;
      return map;
    },
    staleTime: 30_000,
  });
  return query.data ?? {};
}
