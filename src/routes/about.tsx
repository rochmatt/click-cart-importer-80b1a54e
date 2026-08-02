import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPageLayout, LegalCallout } from "@/components/store/LegalPageLayout";

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
      { property: "og:url", content: "/about" },
      { property: "og:site_name", content: "PasarPilih" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <LegalPageLayout
      heading="About PasarPilih"
      lead="This page is maintained by PT RAFA KPT to explain who we are and how the service works."
    >
      <p>
        PasarPilih is operated by{" "}
        <strong className="text-foreground">PT RAFA KPT</strong>. We are a
        product aggregator and direct seller that helps Indonesian shoppers
        discover the best deals, flash sales, and vouchers from trusted
        marketplaces such as Shopee, Tokopedia, and TikTok Shop. For selected
        products, PasarPilih also manages payment and shipping directly.
      </p>

      <h2>What we do</h2>
      <ul>
        <li>
          Curate products across categories like electronics, fashion, home, and
          daily essentials.
        </li>
        <li>Show price comparisons, ratings, and available vouchers in one place.</li>
        <li>
          Let you save items to a wishlist or cart, then complete checkout on
          PasarPilih or on the partner marketplace of your choice.
        </li>
        <li>
          Provide order tracking, customer support, and status updates for
          purchases made through our platform.
        </li>
      </ul>

      <h2>Why choose us</h2>
      <p>
        We believe shopping should be simple. By bringing together deals from
        multiple trusted platforms and offering direct sales on selected items,
        you spend less time switching apps and more time deciding what matters to
        you. When you buy through a partner marketplace, the final price, stock,
        and shipping terms are set by that marketplace. When you buy directly
        from PasarPilih, we handle your order from checkout to delivery.
      </p>

      <h2>Our company details</h2>
      <ul>
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

      <h2>Our mission</h2>
      <p>
        To make online shopping in Indonesia more transparent, faster, and more
        rewarding — one curated pick at a time.
      </p>

      <LegalCallout title="Questions or feedback?">
        <p>
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
      </LegalCallout>
    </LegalPageLayout>
  );
}
