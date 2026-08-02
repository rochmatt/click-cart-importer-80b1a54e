import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ChatFab } from "@/components/store/ChatFab";
import { Search, ExternalLink, Truck, PackageCheck } from "lucide-react";

const title = "How It Works — PasarPilih";
const description =
  "Learn how PasarPilih curates products, compares prices, and redirects you to trusted marketplaces for checkout and order tracking.";

export const Route = createFileRoute("/how-it-works")({
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
  component: HowItWorksPage,
});

const steps = [
  {
    icon: Search,
    title: "Browse & compare",
    description:
      "Explore curated products across categories. Use filters, search, and recommendations to find what you need.",
  },
  {
    icon: ExternalLink,
    title: "Click to the marketplace",
    description:
      "When you find something you like, click the product to see the live listing on the destination marketplace.",
  },
  {
    icon: PackageCheck,
    title: "Checkout on the seller's site",
    description:
      "Complete payment, shipping, and delivery options directly with the marketplace or seller. PasarPilih does not process the order.",
  },
  {
    icon: Truck,
    title: "Track your delivery",
    description:
      "Use our Track Order page with your order number to follow shipment status and get email updates if you choose.",
  },
];

function HowItWorksPage() {
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
          How PasarPilih works
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          This page is maintained by PasarPilih to explain the shopping flow. We
          are a curator, not a seller, so your purchase always happens on a
          marketplace you trust.
        </p>

        <ol className="mt-10 space-y-6">
          {steps.map(({ icon: Icon, title, description }, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground sm:text-base">
                  {i + 1}. {title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-border bg-secondary/50 p-6">
          <p className="font-medium text-foreground">Important note</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            PasarPilih does not set prices, manage inventory, or handle
            deliveries. The marketplace shown on each product page is the
            seller of record. Always review the seller's details, shipping
            options, and return policy before you buy.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/search"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start browsing
          </Link>
          <Link
            to="/faq"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Read FAQ
          </Link>
        </div>
      </main>

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
