import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { HeroCarousel } from "@/components/store/HeroCarousel";
import { QuickActions } from "@/components/store/QuickActions";
import { FlashSale } from "@/components/store/FlashSale";
import { PromoBanners } from "@/components/store/PromoBanners";
import { DiscoverFeed } from "@/components/store/DiscoverFeed";
import { ChatFab } from "@/components/store/ChatFab";
import { Footer } from "@/components/store/Footer";

const title = "PasarPilih — Flash Sales, Vouchers & Daily Deals in Indonesia";
const description =
  "Shop flash sale deals, claim vouchers and discover trending products daily — one curated catalog with free shipping across Indonesia.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />
      <main>
        <HeroCarousel />
        <QuickActions />
        <FlashSale />
        <PromoBanners />
        <DiscoverFeed query={query} />
      </main>
      <Footer />
      <ChatFab />
    </div>
  );
}
