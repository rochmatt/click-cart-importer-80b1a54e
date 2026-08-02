import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ChatFab } from "@/components/store/ChatFab";

const title = "About Us — PasarPilih";
const description =
  "PasarPilih is operated by PT RAFA KPT. We sell products directly and curate deals from trusted marketplaces across Indonesia.";

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
          This page is maintained by PT RAFA KPT to explain who we are and how
          the service works. The details below are editable by the app owner and
          are not a certification or legal opinion.
        </p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            PasarPilih is operated by{" "}
            <strong className="text-foreground">PT RAFA KPT</strong>. We are a
            product aggregator and direct seller that helps Indonesian shoppers
            discover the best deals, flash sales, and vouchers from trusted
            marketplaces such as Shopee, Tokopedia, and TikTok Shop. For selected
            products, PasarPilih also manages payment and shipping directly.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-foreground">
            What we do
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              Curate products across categories like electronics, fashion, home,
              and daily essentials.
            </li>
            <li>
              Show price comparisons, ratings, and available vouchers in one place.
            </li>
            <li>
              Let you save items to a wishlist or cart, then complete checkout
              on PasarPilih or on the partner marketplace of your choice.
            </li>
            <li>
              Provide order tracking, customer support, and status updates for
              purchases made through our platform.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold text-foreground">
            Why choose us
          </h2>
          <p>
            We believe shopping should be simple. By bringing together deals from
            multiple trusted platforms and offering direct sales on selected
            items, you spend less time switching apps and more time deciding
            what matters to you. When you buy through a partner marketplace, the
            final price, stock, and shipping terms are set by that marketplace.
            When you buy directly from PasarPilih, we handle your order from
            checkout to delivery.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-foreground">
            Our company details
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong className="text-foreground">Legal name:</strong> PT RAFA KPT
            </li>
            <li>
              <strong className="text-foreground">Address:</strong> DS. LAHAR RT3 RW1
            </li>
            <li>
              <strong className="text-foreground">Support email:</strong>{" "}
              <a
                href="mailto:adin@inipilihanku.com"
                className="text-primary hover:underline"
              >
                adin@inipilihanku.com
              </a>
            </li>
            <li>
              <strong className="text-foreground">Support hours:</strong> 07:00 – 00:00
            </li>
          </ul>

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
