import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AnnouncementBar,
} from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ChatFab } from "@/components/store/ChatFab";

const title = "About Us — PasarPilih";
const description =
  "PasarPilih is a product aggregator that curates deals from Indonesia's top marketplaces so you can compare, click, and checkout where you trust.";

export const Route = createFileRoute("/about")({
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
  component: AboutPage,
});

function AboutPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ← Back to shopping
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
          About PasarPilih
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          This page is maintained by PasarPilih to explain who we are and how
          the service works. The details below are editable by the app owner and
          are not a certification or legal opinion.
        </p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            PasarPilih is a product aggregator built to help Indonesian shoppers
            discover the best deals, flash sales, and vouchers from the
            marketplaces they already use. We do not sell products ourselves
            and we do not hold inventory. Instead, we curate listings and send
            you to the destination marketplace to complete the checkout.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-foreground">
            What we do
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              Curate products across categories like electronics, fashion,
              home, and daily essentials.
            </li>
            <li>
              Show price comparisons, ratings, and available vouchers in one
              place.
            </li>
            <li>
              Let you save items to a wishlist or cart, then redirect you to the
              original marketplace to buy.
            </li>
            <li>
              Provide order tracking and status updates after you complete a
              purchase.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold text-foreground">
            Why choose us
          </h2>
          <p>
            We believe shopping should be simple. By bringing together deals
            from multiple trusted platforms, you spend less time switching apps
            and more time deciding what matters to you. Prices and availability
            are always set by the destination marketplace, so what you see is
            what the seller offers at that moment.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-foreground">
            Our mission
          </h2>
          <p>
            To make online shopping in Indonesia more transparent, faster, and
            more rewarding — one curated pick at a time.
          </p>

          <div className="mt-10 rounded-2xl border border-border bg-secondary/50 p-6">
            <p className="font-medium text-foreground">Questions or feedback?</p>
            <p className="mt-1">
              Visit our{" "}
              <Link to="/contact" className="text-primary hover:underline">
                Contact page
              </Link>{" "}
              or{" "}
              <Link to="/faq" className="text-primary hover:underline">
                FAQ
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
