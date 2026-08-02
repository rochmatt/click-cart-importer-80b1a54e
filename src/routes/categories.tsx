import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { categoryCatalog, productsInCategory } from "@/data/categories";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { ChatFab } from "@/components/store/ChatFab";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/structured-data";

const TITLE = "All Categories — Browse the PasarPilih Catalog";
const DESCRIPTION =
  "Browse every PasarPilih category — fashion, electronics, home & living, beauty, sports, kids, gaming and kitchen — and compare prices across marketplaces.";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/categories" }],
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/categories" },
        ]),
      ),
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const [headerQuery, setHeaderQuery] = useState("");
  const [query, setQuery] = useState("");

  const cards = useMemo(() => {
    const term = query.trim().toLowerCase();
    return categoryCatalog
      .map((c) => {
        const items = productsInCategory(c.label);
        return {
          ...c,
          count: items.length,
          thumbs: items.slice(0, 3).map((p) => ({ id: p.id, image: p.images[0], title: p.title })),
        };
      })
      .filter((c) =>
        term ? c.label.toLowerCase().includes(term) || c.blurb.toLowerCase().includes(term) : true,
      );
  }, [query]);

  const total = categoryCatalog.reduce((sum, c) => sum + productsInCategory(c.label).length, 0);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={headerQuery} onQueryChange={setHeaderQuery} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link to="/" className="transition-colors hover:text-primary">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground" aria-current="page">
              Categories
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              <LayoutGrid className="h-6 w-6 text-primary" aria-hidden="true" />
              Semua Kategori
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Pilih kategori untuk langsung melihat produk pilihan kami — harga selalu dibandingkan
              antar marketplace.
            </p>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {cards.length} kategori · {total} produk
          </p>
        </div>

        {cards.length > 0 ? (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((c) => (
              <li key={c.slug} className="h-full">
                <Link
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-bold text-foreground group-hover:text-primary">
                      {c.label}
                    </h2>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                      {c.count} produk
                    </span>
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{c.blurb}</p>

                  {c.thumbs.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {c.thumbs.map((t) => (
                        <div
                          key={t.id}
                          className="aspect-square overflow-hidden rounded-lg bg-muted"
                        >
                          <img
                            src={t.image}
                            alt={t.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary">
                    Lihat kategori
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-semibold text-foreground">Kategori tidak ditemukan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Coba kata kunci lain di kolom pencarian.
            </p>
          </div>
        )}
      </main>

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
