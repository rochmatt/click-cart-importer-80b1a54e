import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { products as catalog } from "@/data/products";

export type ProductStatus = "active" | "draft";

export type Variation = {
  id: string;
  name: string;
  options: string;
};

export type CustomAttribute = {
  id: string;
  key: string;
  value: string;
};

export type WarrantyStatus = "none" | "store" | "official";

export type AdminProduct = {
  id: string;
  title: string;
  category: string;
  description: string;
  images: string[];
  price: number;
  salePrice: number | null;
  status: ProductStatus;
  stock: number;
  variations: Variation[];
  links: { shopee: string; tokopedia: string; tiktok: string };
  weight: string;
  dimensions: string;
  seoTitle: string;
  seoDescription: string;
  brand: string;
  sizeOptions: string[];
  warrantyStatus: WarrantyStatus;
  warrantyDuration: string;
  customAttributes: CustomAttribute[];
  updatedAt: string;
};

export const CATEGORY_GROUPS = [
  { group: "Fashion", items: ["Fashion", "Men's Clothing", "Women's Clothing"] },
  { group: "Electronics", items: ["Electronics", "Phone Accessories", "PC", "Laptop"] },
  { group: "Other", items: ["Others"] },
] as const;

export const CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.items) as string[];

export const WARRANTY_OPTIONS: { value: WarrantyStatus; label: string }[] = [
  { value: "none", label: "No Warranty" },
  { value: "store", label: "Store Warranty" },
  { value: "official", label: "Official / Brand Warranty" },
];


export function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Seeded rows reference bundled catalog imagery by catalog_ref. */
function catalogImages(ref: string | null): string[] {
  if (!ref) return [];
  return catalog.find((p) => p.id === ref)?.images ?? [];
}

type Row = {
  id: string;
  title: string;
  category: string;
  description: string;
  images: string[];
  price: number;
  sale_price: number | null;
  status: string;
  stock: number;
  variations: unknown;
  links: unknown;
  weight: string;
  dimensions: string;
  seo_title: string;
  seo_description: string;
  brand: string | null;
  size_options: string[] | null;
  warranty_status: string | null;
  warranty_duration: string | null;
  custom_attributes: unknown;
  catalog_ref: string | null;
  updated_at: string;
};

function toProduct(row: Row): AdminProduct {
  const links = (row.links ?? {}) as Partial<AdminProduct["links"]>;
  const warranty = row.warranty_status;
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    images: row.images?.length ? row.images : catalogImages(row.catalog_ref),
    price: Number(row.price),
    salePrice: row.sale_price === null ? null : Number(row.sale_price),
    status: row.status === "active" ? "active" : "draft",
    stock: row.stock,
    variations: Array.isArray(row.variations) ? (row.variations as Variation[]) : [],
    links: {
      shopee: links.shopee ?? "",
      tokopedia: links.tokopedia ?? "",
      tiktok: links.tiktok ?? "",
    },
    weight: row.weight,
    dimensions: row.dimensions,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    brand: row.brand ?? "",
    sizeOptions: Array.isArray(row.size_options) ? row.size_options : [],
    warrantyStatus:
      warranty === "store" || warranty === "official" ? warranty : "none",
    warrantyDuration: row.warranty_duration ?? "",
    customAttributes: Array.isArray(row.custom_attributes)
      ? (row.custom_attributes as CustomAttribute[])
      : [],
    updatedAt: row.updated_at,
  };
}

/** Trims and collapses inner whitespace so category names stay canonical. */
export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Case- and whitespace-insensitive key used to detect duplicate categories. */
export function categoryKey(value: string): string {
  return normalizeCategoryName(value).toLowerCase();
}

/**
 * Resolves a typed category to its canonical catalog spelling when one exists,
 * so "  women's  CLOTHING " never becomes a second category.
 */
export function canonicalCategory(value: string, known: string[] = CATEGORIES): string {
  const normalized = normalizeCategoryName(value);
  const match = known.find((c) => categoryKey(c) === categoryKey(normalized));
  return match ?? normalized;
}

function toRow(p: AdminProduct) {
  return {
    title: p.title,
    category: canonicalCategory(p.category),
    description: p.description,

    // Blob URLs from the local file picker cannot be persisted.
    images: p.images.filter((src) => !src.startsWith("blob:")),
    price: p.price,
    sale_price: p.salePrice,
    status: p.status,
    stock: p.stock,
    variations: p.variations,
    links: p.links,
    weight: p.weight,
    dimensions: p.dimensions,
    seo_title: p.seoTitle,
    seo_description: p.seoDescription,
    brand: p.brand,
    size_options: p.sizeOptions,
    warranty_status: p.warrantyStatus,
    warranty_duration: p.warrantyDuration,
    custom_attributes: p.customAttributes,
  };
}


const YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Uploads picked files to storage and returns durable signed URLs. */
export async function uploadProductImages(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${newId()}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data, error: signError } = await supabase.storage
      .from("product-images")
      .createSignedUrl(path, YEAR_SECONDS);
    if (signError) throw signError;
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}

export const productsQueryKey = ["admin-products"] as const;

async function fetchProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase
    .from("admin_products")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(toProduct);
}

export function useAdminProductsQuery() {
  return useQuery({ queryKey: productsQueryKey, queryFn: fetchProducts });
}

export function useAdminProduct(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: [...productsQueryKey, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? toProduct(data as unknown as Row) : null;
    },
  });
}

export function emptyProduct(): AdminProduct {
  return {
    id: "",
    title: "",
    category: CATEGORIES[0],
    description: "",
    images: [],
    price: 0,
    salePrice: null,
    status: "draft",
    stock: 0,
    variations: [],
    links: { shopee: "", tokopedia: "", tiktok: "" },
    weight: "",
    dimensions: "",
    seoTitle: "",
    seoDescription: "",
    brand: "",
    sizeOptions: [],
    warrantyStatus: "none",
    warrantyDuration: "",
    customAttributes: [],

    updatedAt: new Date().toISOString(),
  };
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: productsQueryKey });
}

export function useSaveProduct() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (product: AdminProduct) => {
      const payload = toRow(product);
      if (product.id) {
        const { data, error } = await supabase
          .from("admin_products")
          .update(payload)
          .eq("id", product.id)
          .select()
          .single();
        if (error) throw error;
        return toProduct(data as unknown as Row);
      }
      const { data, error } = await supabase
        .from("admin_products")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return toProduct(data as unknown as Row);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteProducts() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("admin_products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Re-inserts previously deleted products (same ids) to support undo. */
export function useRestoreProducts() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (items: AdminProduct[]) => {
      const payload = items.map((p) => ({ id: p.id, ...toRow(p) }));
      const { error } = await supabase.from("admin_products").insert(payload);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ProductStatus }) => {
      const { error } = await supabase.from("admin_products").update({ status }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Renames a category across the catalog and optionally bulk-sets product status. */
export function useUpdateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      from,
      to,
      status,
    }: {
      from: string;
      to: string;
      status: ProductStatus | null;
    }) => {
      const target = normalizeCategoryName(to);
      const payload: { category?: string; status?: ProductStatus } = {};
      if (categoryKey(target) !== categoryKey(from) || target !== from) {
        payload.category = target;
      }
      if (status) payload.status = status;
      if (Object.keys(payload).length === 0) return;
      // Match case-insensitively so legacy rows with odd capitalisation are merged.
      const { error } = await supabase
        .from("admin_products")
        .update(payload)
        .ilike("category", normalizeCategoryName(from));
      if (error) throw error;

    },
    onSuccess: invalidate,
  });
}
