import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCatalogRows, fetchStockRows } from "@/lib/catalog.functions";
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
  // NOT NULL DEFAULT di database — lihat db/schema.sql. Sebelumnya ditulis
  // `number | null` di sini, dan ketidakcocokan itulah yang membuat cabang
  // `?? seed?.rating` di toProduct terlihat seperti penjaga sungguhan padahal
  // tidak pernah tereksekusi. Tipe yang berbohong tentang skema menyembunyikan
  // bug, bukan mencegahnya.
  rating: number;
  reviews: number;
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

/**
 * Menggabungkan baris database dengan produk seed.
 *
 * HATI-HATI DENGAN `??` DI SINI. Kolom rating, reviews, dan stock di
 * admin_products bersifat NOT NULL dengan DEFAULT, jadi cabang `?? seed?.x`
 * pada ketiganya TIDAK PERNAH tereksekusi — database selalu menang. Itu bukan
 * kesalahan, tapi pernah menyembunyikan bug yang mahal: nilai DEFAULT kolom
 * (4.7 dan 0) membuat kedelapan produk menampilkan "4.7 (0 ulasan)" yang sama
 * persis, sementara JSON-LD membaca seed langsung dan memberi tahu Google angka
 * yang berbeda. Cabang fallback-nya terlihat seolah menjaga, padahal mati.
 *
 * Jadi: kalau sebuah kolom NOT NULL terlihat salah di etalase, perbaiki DATANYA
 * (lihat db/007-rating-awal.sql), bukan pemetaan ini.
 */
function toProduct(row: Row, seed?: Product): Product {
  const price = row.sale_price ?? row.price;
  const images = row.images?.length ? row.images : (seed?.images ?? []);
  return {
    id: seed?.id ?? row.id,
    title: row.title || seed?.title || "Untitled product",
    category: row.category || seed?.category || "Fashion",
    price: idr(price),
    oldPrice: row.sale_price && row.price > row.sale_price ? idr(row.price) : seed?.oldPrice,
    rating: Number(row.rating),
    reviews: row.reviews,
    stock: row.stock ?? seed?.stock ?? 0,
    sold: seed?.sold ?? 0,
    images,
    links: (row.links as Product["links"]) ?? seed?.links ?? defaultLinks,
    description: row.description || seed?.description || "",
    specs: specsFrom(row).length ? specsFrom(row) : (seed?.specs ?? []),
    detailedSpecs: detailedSpecsFrom(row).length ? detailedSpecsFrom(row) : seed?.detailedSpecs,
  };
}

// Daftar kolomnya sekarang tinggal di catalog.functions.ts bersama query-nya,
// supaya tidak ada dua sumber kebenaran yang bisa menyimpang diam-diam.

async function fetchLiveProducts(): Promise<Row[]> {
  return (await fetchCatalogRows()) as unknown as Row[];
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
      const rows = (await fetchStockRows()) as {
        id: string;
        catalog_ref: string | null;
        stock: number | null;
      }[];
      const map: Record<string, number> = {};
      for (const row of rows) map[row.catalog_ref || row.id] = row.stock ?? 0;
      return map;
    },
    staleTime: 30_000,
  });
  return query.data ?? {};
}
