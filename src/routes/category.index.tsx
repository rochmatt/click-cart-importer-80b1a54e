import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LayoutGrid, Search } from "lucide-react";
import { categoryCatalog, productsInCategory } from "@/data/categories";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { ChatFab } from "@/components/store/ChatFab";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/structured-data";

const TITLE = "Browse Subcategories — PasarPilih Category Directory";
const DESCRIPTION =
  "Jelajahi semua subkategori PasarPilih dalam satu halaman — fashion, elektronik, rumah, beauty, sports, kids, gaming dan dapur — agar kamu langsung menemukan produk yang dicari.";

export const Route = createFileRoute("/category/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/category" }],
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Subcategories", path: "/category" },
        ]),
      ),
    ],
  }),
  component: CategoryDirectoryPage,
});

function CategoryDirectoryPage() {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    return categoryCatalog
      .map((c) => {
        const subs = term
          ? c.subcategories.filter((s) => s.toLowerCase().includes(term))
          : c.subcategories;
        const matchesCategory = term ? c.label.toLowerCase().includes(term) : true;
        return {
          ...c,
          count: productsInCategory(c.label).length,
          subs: matchesCategory ? c.subcategories : subs,
          visible: matchesCategory || subs.length > 0,
        };
      })
      .filter((c) => c.visible);
  }, [query]);

  const totalSubs = categoryCatalog.reduce((sum, c) => sum + c.subcategories.length, 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AnnouncementBar />
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-10">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link to="/" className="hover:text-primary">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground">Subkategori</li>
          </ol>
        </nav>

        <header className="mt-4">
          <div className="flex items-center gap-2 text-primary">
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-semibold uppercase tracking-wide">Direktori</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            Semua Subkategori
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {categoryCatalog.length} kategori utama dan {totalSubs} subkategori. Pilih subkategori
            untuk langsung melihat produk yang relevan.
          </p>

          <div className="relative mt-4 max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari subkategori, mis. sneakers"
              aria-label="Cari subkategori"
              className="h-11 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </header>

        {groups.length === 0 ? (
          <p className="mt-10 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Tidak ada subkategori yang cocok dengan "{query}".
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((c) => (
              <section
                key={c.slug}
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-foreground">{c.label}</h2>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.blurb}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {c.count} produk
                  </span>
                </div>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {c.subs.map((sub) => (
                    <li key={sub}>
                      <Link
                        to="/search"
                        search={{ q: sub }}
                        className="inline-flex h-9 items-center whitespace-nowrap rounded-full border border-border bg-background px-3 text-xs font-medium leading-none text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {sub}
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Lihat semua {c.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </section>
            ))}
          </div>
        )}
      </main>

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
