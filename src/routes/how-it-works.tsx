import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ExternalLink, PackageCheck, Truck } from "lucide-react";
import { LegalPageLayout, LegalCallout } from "@/components/store/LegalPageLayout";

const title = "How It Works — PasarPilih";
const description =
  "Learn how PasarPilih curates products, links you to trusted marketplaces, and helps you track your delivery.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "/how-it-works" },
      { property: "og:site_name", content: "PasarPilih" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/how-it-works" }],
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
  return (
    <LegalPageLayout
      heading="How PasarPilih works"
      lead="This page explains the shopping flow, from browsing curated picks to tracking your delivery."
    >
      <ol className="space-y-4">
        {steps.map(({ icon: Icon, title: stepTitle, description: stepDesc }, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:gap-4 sm:p-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground sm:h-10 sm:w-10">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="!mt-0 text-sm font-semibold text-foreground sm:text-base">
                {i + 1}. {stepTitle}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {stepDesc}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <LegalCallout title="Important note">
        <p>
          PasarPilih does not set prices, manage inventory, or handle deliveries
          for partner-marketplace listings. The marketplace shown on each product
          page is the seller of record. Always review the seller's details,
          shipping options, and return policy before you buy.
        </p>
      </LegalCallout>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          to="/search"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start browsing
        </Link>
        <Link
          to="/faq"
          className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Read FAQ
        </Link>
      </div>
    </LegalPageLayout>
  );
}
