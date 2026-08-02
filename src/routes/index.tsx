import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
