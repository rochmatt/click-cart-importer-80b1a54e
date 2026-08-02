import { useQuery } from "@tanstack/react-query";
import { fetchImageOverrideRows } from "@/lib/catalog.functions";

type CoverRow = { catalog_ref: string | null; images: string[] | null };

/**
 * The admin dashboard lets merchants reorder images and pick a cover.
 * Storefront views read that ordering (keyed by catalog reference) so the
 * selected cover is always the primary thumbnail.
 *
 * Datanya kini datang dari PostgreSQL lokal lewat server function, bukan dari
 * Supabase langsung — lihat catatan di catalog.functions.ts.
 */
async function fetchImageOverrides(): Promise<Record<string, string[]>> {
  const rows = (await fetchImageOverrideRows()) as CoverRow[];
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    if (row.catalog_ref && row.images?.length) map[row.catalog_ref] = row.images;
  }
  return map;
}

export function useImageOverrides() {
  return useQuery({
    queryKey: ["storefront-image-overrides"],
    queryFn: fetchImageOverrides,
    staleTime: 60_000,
  });
}

/** Ordered image list for a catalog product, with the admin cover first. */
export function useProductImages(catalogId: string, fallback: string[]): string[] {
  const { data } = useImageOverrides();
  const override = data?.[catalogId];
  return override?.length ? override : fallback;
}

/** The primary thumbnail for a catalog product. */
export function useCoverImage(catalogId: string, fallback: string[]): string {
  return useProductImages(catalogId, fallback)[0];
}
