import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound, stripSearchParams } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  SlidersHorizontal,
} from "lucide-react";
import { CategoryFilters, activeFilterCount } from "@/components/store/CategoryFilters";
import type { CategoryFilterState } from "@/components/store/CategoryFilters";
import { categoryCatalog, findCategory, productsInCategory } from "@/data/categories";
import { ProductCard } from "@/components/store/ProductCard";
import { QuickViewModal } from "@/components/store/QuickViewModal";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { ChatFab } from "@/components/store/ChatFab";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import type { Product } from "@/data/products";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/structured-data";
import { NotFoundPage } from "@/components/store/NotFoundPage";
import { getRequestOrigin } from "@/lib/origin.functions";
import {
  CATEGORY_PAGE_SIZE,
  hitungHalaman,
  jendelaHalaman,
  metaPaginationKategori,
} from "@/lib/category-pagination";
import { CATEGORY_SEARCH_DEFAULTS, categorySearchSchema } from "@/lib/category-search-params";
import { ringkasanFilterAktif } from "@/lib/category-filter-summary";

type SortKey = "popular" | "rating" | "price-low" | "price-high";

const sortKeys: SortKey[] = ["popular", "rating", "price-low", "price-high"];

const categoryGroups = [
  {
    title: "Gaya & Penampilan",
    items: categoryCatalog.filter((c) => ["fashion", "beauty"].includes(c.slug)),
  },
  {
    title: "Teknologi & Hiburan",
    items: categoryCatalog.filter((c) => ["electronics", "gaming"].includes(c.slug)),
  },
  {
    title: "Rumah & Dapur",
    items: categoryCatalog.filter((c) => ["home-living", "kitchen"].includes(c.slug)),
  },
  {
    title: "Aktivitas & Keluarga",
    items: categoryCatalog.filter((c) => ["sports", "kids"].includes(c.slug)),
  },
];

const priceValue = (price: string) => Number(price.replace(/[^\d]/g, "")) || 0;

const idrCompact = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

export const Route = createFileRoute("/category/$slug")({
  validateSearch: zodValidator(categorySearchSchema),
  search: {
    middlewares: [stripSearchParams(CATEGORY_SEARCH_DEFAULTS)],
  },
  // Halaman ikut menentukan metadata (canonical/prev/next), jadi loader harus
  // dijalankan ulang saat ?page berubah — bukan hanya saat slug berubah.
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ params, deps }) => {
    const category = findCategory(params.slug);
    if (!category) throw notFound();
    const products = productsInCategory(category.label);
    const prices = products.map((p) => priceValue(p.price)).filter((n) => n > 0);
    // Total halaman untuk SEO dihitung dari SELURUH produk kategori (keadaan
    // yang di-crawl mesin pencari; filter hanya query param sisi klien).
    const { page, totalPages } = hitungHalaman(products.length, deps.page);
    return {
      ...category,
      productCount: products.length,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      topRating: products.reduce((m, p) => Math.max(m, p.rating), 0),
      origin: await getRequestOrigin(),
      page,
      totalPages,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      const title = "Kategori tidak ditemukan — PasarPilih";
      const description = "Kategori ini tidak tersedia di PasarPilih.";
      return {
        meta: [
          { title },
          { name: "description", content: description },
          { property: "og:title", content: title },
          { property: "og:description", content: description },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
          { name: "robots", content: "noindex" },
        ],
        links: [],
        scripts: [],
      };
    }

    const path = `/category/${loaderData.slug}`;
    // canonical (menunjuk halaman ini sendiri) + rel prev/next + label halaman.
    const seo = metaPaginationKategori(
      loaderData.origin,
      loaderData.slug,
      loaderData.page,
      loaderData.totalPages,
    );
    const canonical = seo.links[0].href;
    const priceRange =
      loaderData.maxPrice > 0
        ? ` Harga Rp${idrCompact(loaderData.minPrice)}–Rp${idrCompact(loaderData.maxPrice)}.`
        : "";
    const title = `${loaderData.label} — ${loaderData.productCount} Produk Terbaik${seo.labelJudul} | PasarPilih`;
    const description =
      (
        `${loaderData.blurb} Bandingkan ${loaderData.productCount} produk ${loaderData.label.toLowerCase()} ` +
        `dari Shopee, Tokopedia, dan TikTok Shop.${priceRange} Filter harga, rating, dan pencarian.`
      ).slice(0, 300) + seo.labelDeskripsi;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "og:site_name", content: "PasarPilih" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      // canonical + rel=prev/next: satu URL kanonik per halaman agar mesin
      // pencari tidak menduplikasi konten antar halaman pagination.
      links: seo.links,
      scripts: [
        jsonLdScript(
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: loaderData.label, path },
          ]),
        ),
        jsonLdScript(itemListJsonLd(loaderData.label, productsInCategory(loaderData.label))),
      ],
    };
  },
  component: CategoryPage,
  notFoundComponent: () => (
    <NotFoundPage
      judul="Category not found"
      pesan="That category does not exist. Pick one below."
    />
  ),
});

function CategoryPage() {
  const category = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState("");
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // URL menyimpan harga sebagai number (URL bersih); state filter UI memakai
  // string. Konversi di batas ini: 0 di URL berarti "tak ada filter" → "".
  const filters: CategoryFilterState = useMemo(
    () => ({
      query: search.q,
      minPrice: search.min > 0 ? String(search.min) : "",
      maxPrice: search.max > 0 ? String(search.max) : "",
      minRating: [0, 3.5, 4, 4.5].includes(search.rating) ? search.rating : 0,
    }),
    [search.q, search.min, search.max, search.rating],
  );

  const sort: SortKey = sortKeys.includes(search.sort as SortKey)
    ? (search.sort as SortKey)
    : "popular";

  const setFilters = (next: CategoryFilterState) => {
    navigate({
      to: ".",
      search: {
        ...search,
        q: next.query,
        min: Number(next.minPrice) || 0,
        max: Number(next.maxPrice) || 0,
        rating: next.minRating,
        page: 1, // filter berubah → kembali ke halaman 1
      },
      replace: true,
      resetScroll: false,
    });
  };

  const setSort = (next: SortKey) => {
    navigate({
      to: ".",
      search: { ...search, sort: next, page: 1 },
      replace: true,
      resetScroll: false,
    });
  };

  const all = useMemo(() => productsInCategory(category.label), [category.label]);

  const priceBounds = useMemo(() => {
    const values = all.map((p) => priceValue(p.price));
    return {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
    };
  }, [all]);

  const searchTerm = (filters.query.trim() || query.trim()).toLowerCase();

  const items = useMemo(() => {
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;
    const list = all.filter((p) => {
      if (
        searchTerm &&
        !p.title.toLowerCase().includes(searchTerm) &&
        !p.description.toLowerCase().includes(searchTerm)
      )
        return false;
      const value = priceValue(p.price);
      if (min !== null && value < min) return false;
      if (max !== null && max > 0 && value > max) return false;
      if (filters.minRating > 0 && p.rating < filters.minRating) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    else if (sort === "price-low") sorted.sort((a, b) => priceValue(a.price) - priceValue(b.price));
    else if (sort === "price-high")
      sorted.sort((a, b) => priceValue(b.price) - priceValue(a.price));
    else sorted.sort((a, b) => b.reviews - a.reviews);
    return sorted;
  }, [all, searchTerm, filters.minPrice, filters.maxPrice, filters.minRating, sort]);

  /** Products matching every filter except rating — the base for rating counts. */
  const withoutRating = useMemo(() => {
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;
    return all.filter((p) => {
      if (
        searchTerm &&
        !p.title.toLowerCase().includes(searchTerm) &&
        !p.description.toLowerCase().includes(searchTerm)
      )
        return false;
      const value = priceValue(p.price);
      if (min !== null && value < min) return false;
      if (max !== null && max > 0 && value > max) return false;
      return true;
    });
  }, [all, searchTerm, filters.minPrice, filters.maxPrice]);

  const ratingCounts = useMemo(() => {
    const entries: Record<string, number> = {};
    for (const r of [0, 3.5, 4, 4.5]) {
      entries[String(r)] = withoutRating.filter((p) => p.rating >= r).length;
    }
    return entries;
  }, [withoutRating]);

  const categoryCounts = useMemo(() => {
    const entries: Record<string, number> = {};
    for (const c of categoryCatalog) {
      entries[c.slug] = productsInCategory(c.label).length;
    }
    return entries;
  }, []);

  const subcategoryCounts = useMemo(() => {
    const entries: Record<string, number> = {};
    for (const sub of category.subcategories) {
      const words: string[] = sub
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w: string) => w.length > 2);
      entries[sub] = all.filter((p) => {
        const haystack = `${p.title} ${p.description}`.toLowerCase();
        return words.some((w: string) => haystack.includes(w));
      }).length;
    }
    return entries;
  }, [all, category.subcategories]);

  // Pagination sisi klien atas hasil terfilter+terurut. Metadata SEO (head)
  // memakai jumlah penuh kategori; UI di sini mengikuti apa yang benar-benar
  // tampil setelah filter.
  const paginasi = hitungHalaman(items.length, search.page, CATEGORY_PAGE_SIZE);
  const pageItems = items.slice(paginasi.start, paginasi.end);

  // Ringkasan filter aktif untuk screen reader. Dibacakan saat filter berubah
  // DAN saat halaman pertama dimuat: region aria-live tidak mengumumkan konten
  // awalnya, jadi isinya disetel lewat useEffect (mulai kosong → terisi setelah
  // mount) sehingga perubahan pertama pun terdengar.
  const ringkasan = useMemo(
    () =>
      ringkasanFilterAktif(
        {
          pencarian: filters.query.trim() || query.trim(),
          hargaMin: search.min,
          hargaMax: search.max,
          rating: filters.minRating,
        },
        items.length,
      ),
    [filters.query, filters.minRating, query, search.min, search.max, items.length],
  );
  const [ringkasanDibacakan, setRingkasanDibacakan] = useState("");
  useEffect(() => {
    setRingkasanDibacakan(ringkasan);
  }, [ringkasan]);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto max-w-7xl px-4 py-8 pb-36 sm:px-6 sm:pb-24 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link to="/" className="transition-colors hover:text-primary">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground" aria-current="page">
              {category.label}
            </li>
          </ol>
        </nav>

        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {category.label}: {category.productCount} Produk Pilihan
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {category.blurb}
          {category.maxPrice > 0
            ? ` Rentang harga Rp${idrCompact(category.minPrice)}–Rp${idrCompact(category.maxPrice)}${
                category.topRating > 0 ? `, rating hingga ${category.topRating}` : ""
              }.`
            : ""}
        </p>

        <div className="mt-6 lg:grid lg:grid-cols-[280px_1fr] lg:gap-8 lg:items-start">
          <aside
            id="category-filter-sidebar"
            className={`lg:sticky lg:top-32 lg:self-start space-y-6 ${
              showFilters ? "block" : "hidden"
            } lg:block`}
          >
            <div className="flex items-center justify-end lg:hidden">
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Tutup
              </button>
            </div>
            <CategoryFilters
              value={filters}
              onChange={setFilters}
              priceBounds={priceBounds}
              variant="sidebar"
              className="mt-0"
              groups={categoryGroups}
              activeSlug={category.slug}
              activeLabel={category.label}
              subcategories={category.subcategories}
              categoryCounts={categoryCounts}
              subcategoryCounts={subcategoryCounts}
              ratingCounts={ratingCounts}
            />
          </aside>

          <div className="mt-6 space-y-6 lg:mt-0">
            {/* Ringkasan filter aktif — satu-satunya region yang diumumkan ke
                screen reader (saat filter berubah & saat halaman dimuat). */}
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {ringkasanDibacakan}
            </p>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {/* Versi visual — disembunyikan dari screen reader agar tidak
                      dibaca ganda dengan ringkasan naratif di atas. */}
                  <p className="text-sm text-muted-foreground" aria-hidden="true">
                    Menampilkan <span className="font-bold text-foreground">{items.length}</span>{" "}
                    produk
                    {searchTerm ? ` untuk “${searchTerm}”` : ""}
                    {activeFilterCount(filters) > 0 ? " yang cocok dengan filter" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFilters((s) => !s)}
                    aria-expanded={showFilters}
                    aria-controls="category-filter-sidebar"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    Filter
                    {activeFilterCount(filters) > 0 ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                        {activeFilterCount(filters)}
                      </span>
                    ) : null}
                  </button>
                  <label htmlFor="category-sort" className="text-sm text-muted-foreground">
                    Urutkan
                  </label>
                  <select
                    id="category-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="popular">Paling populer</option>
                    <option value="rating">Rating tertinggi</option>
                    <option value="price-low">Harga: rendah ke tinggi</option>
                    <option value="price-high">Harga: tinggi ke rendah</option>
                  </select>
                </div>
              </div>
            </div>

            {items.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
                  {pageItems.map((product) => (
                    <ProductCard key={product.id} product={product} onQuickView={setQuickView} />
                  ))}
                </div>

                {paginasi.totalPages > 1 && (
                  <nav
                    aria-label="Navigasi halaman"
                    className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
                  >
                    {paginasi.page > 1 ? (
                      <Link
                        to="."
                        search={(prev) => ({ ...prev, page: paginasi.page - 1 })}
                        rel="prev"
                        aria-label="Halaman sebelumnya"
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Sebelumnya
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-border/60 px-3 text-sm font-medium text-muted-foreground/50"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Sebelumnya
                      </span>
                    )}

                    {jendelaHalaman(paginasi.page, paginasi.totalPages).map((n, idx) =>
                      n === "…" ? (
                        <span
                          key={`gap-${idx}`}
                          aria-hidden="true"
                          className="px-2 text-sm text-muted-foreground"
                        >
                          …
                        </span>
                      ) : n === paginasi.page ? (
                        <span
                          key={n}
                          aria-current="page"
                          className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground"
                        >
                          {n}
                        </span>
                      ) : (
                        <Link
                          key={n}
                          to="."
                          search={(prev) => ({ ...prev, page: n })}
                          aria-label={`Halaman ${n}`}
                          className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {n}
                        </Link>
                      ),
                    )}

                    {paginasi.page < paginasi.totalPages ? (
                      <Link
                        to="."
                        search={(prev) => ({ ...prev, page: paginasi.page + 1 })}
                        rel="next"
                        aria-label="Halaman berikutnya"
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Berikutnya <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-border/60 px-3 text-sm font-medium text-muted-foreground/50"
                      >
                        Berikutnya <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </nav>
                )}
              </>
            ) : (
              <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
                <PackageSearch
                  className="mx-auto h-8 w-8 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="mt-3 font-semibold text-foreground">No products here yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another category or clear your search.
                </p>
                <Link
                  to="/"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Browse all products
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <QuickViewModal
        product={quickView}
        open={quickView !== null}
        onOpenChange={(open) => !open && setQuickView(null)}
      />

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
