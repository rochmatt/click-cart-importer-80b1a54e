import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getRequestOrigin } from "@/lib/origin.functions";
import { products } from "@/data/products";
import { itemListJsonLd, jsonLdScript } from "@/lib/structured-data";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { HeroCarousel } from "@/components/store/HeroCarousel";
import { QuickActions } from "@/components/store/QuickActions";
import { ForYou } from "@/components/store/ForYou";
import { PromoBanners } from "@/components/store/PromoBanners";
import { DiscoverFeed } from "@/components/store/DiscoverFeed";
import { ChatFab } from "@/components/store/ChatFab";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";

const title = "PasarPilih — Personalised Picks, Vouchers & Daily Deals";
const description =
  "Get product recommendations tailored to what you browse, claim vouchers and discover trending picks daily with free shipping across Indonesia.";

// Gambar pratinjau sosial 1200×630 (kartu saat link dibagikan). Dari desain
// mock Antigravity; ganti dengan aset bermerek sendiri bila sudah tersedia.
const OG_IMAGE =
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&h=630&fit=crop";
const OG_IMAGE_ALT = "PasarPilih — rekomendasi personal, voucher & deal harian se-Indonesia";

export const Route = createFileRoute("/")({
  loader: () => getRequestOrigin(),
  head: ({ loaderData }) => {
    const origin = loaderData ?? "";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${origin}/` },
        { property: "og:site_name", content: "PasarPilih" },
        { property: "og:image", content: OG_IMAGE },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: OG_IMAGE_ALT },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: OG_IMAGE },
        { name: "twitter:image:alt", content: OG_IMAGE_ALT },
      ],
      links: [{ rel: "canonical", href: `${origin}/` }],
      scripts: [jsonLdScript(itemListJsonLd("Koleksi Semua Produk", products))],
    };
  },
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />
      <main>
        <h1 className="sr-only">
          PasarPilih — Personalised Picks, Vouchers &amp; Daily Deals across Indonesia
        </h1>
        <HeroCarousel />

        <QuickActions />
        <ForYou />
        <PromoBanners />
        <DiscoverFeed query={query} />
      </main>
      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
