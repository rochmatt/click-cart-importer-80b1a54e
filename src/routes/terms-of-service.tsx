import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ChatFab } from "@/components/store/ChatFab";

const title = "Terms of Service — PasarPilih";
const description =
  "Read the PasarPilih Terms of Service for the rules, responsibilities, and limitations that apply when using our product aggregator.";

export const Route = createFileRoute("/terms-of-service")({
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
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          This page is maintained by PasarPilih as a template for our terms. It
          is not legal advice and should be reviewed by qualified counsel before
          publication.
        </p>

        <article className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of terms</h2>
            <p>
              By accessing or using PasarPilih, you agree to these Terms of
              Service. If you do not agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. About the service</h2>
            <p>
              PasarPilih is a product aggregator. We display products, prices,
              and deals from third-party marketplaces. We are not a seller,
              marketplace, payment processor, or logistics provider. All
              purchases are completed on the destination marketplace.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Accounts</h2>
            <p>
              You may create an account to access features like wishlists,
              order tracking, and personalized recommendations. You are
              responsible for keeping your credentials secure and for all
              activity under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Marketplace links</h2>
            <p>
              Links to third-party marketplaces are provided for convenience.
              PasarPilih does not control those sites and is not responsible for
              their content, pricing, availability, or policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Orders, payments, and returns</h2>
            <p>
              Orders, payments, shipping, and returns are handled by the
              marketplace or seller where you complete the purchase. PasarPilih
              is not party to those transactions and does not guarantee product
              quality or delivery.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Prohibited conduct</h2>
            <p>You agree not to:</p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>use the service for unlawful purposes;</li>
              <li>abuse automation, scraping, or other disruptive tools;</li>
              <li>impersonate another person or misrepresent your identity;</li>
              <li>interfere with the security or availability of the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Intellectual property</h2>
            <p>
              PasarPilih branding, code, and content are owned by us or licensed
              to us. You may not copy, modify, or distribute them without
              permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, PasarPilih is not liable
              for indirect, incidental, or consequential damages arising from
              your use of the service or any third-party marketplace.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Changes to these terms</h2>
            <p>
              We may update these Terms of Service from time to time. Continued
              use of the service after changes means you accept the revised
              terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Contact us</h2>
            <p>
              For questions about these Terms of Service, please contact us
              through the{" "}
              <Link to="/contact" className="text-primary hover:underline">
                Contact page
              </Link>
              .
            </p>
          </section>
        </article>

        <p className="mt-8 text-xs text-muted-foreground">
          Last updated: {new Date().getFullYear()}
        </p>
      </main>

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
