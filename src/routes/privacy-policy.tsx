import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ChatFab } from "@/components/store/ChatFab";

const title = "Privacy Policy — PasarPilih";
const description =
  "Read the PasarPilih Privacy Policy to understand what data we collect, how we use it, and the choices you have over your information.";

export const Route = createFileRoute("/privacy-policy")({
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
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          This page is maintained by PasarPilih as a template for our privacy
          practices. It is not legal advice and should be reviewed by qualified
          counsel before publication.
        </p>

        <article className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>
              PasarPilih respects your privacy. This Privacy Policy explains how
              we collect, use, store, and share information when you use our
              website and services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Information we collect</h2>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>
                <strong className="text-foreground">Account data:</strong> email
                address, name, and password hash when you create an account.
              </li>
              <li>
                <strong className="text-foreground">Activity data:</strong>
                pages viewed, products clicked, searches, wishlist, cart items, and
                order tracking requests.
              </li>
              <li>
                <strong className="text-foreground">Device data:</strong>
                browser type, IP address, and approximate location used for
                security and analytics.
              </li>
              <li>
                <strong className="text-foreground">Communication data:</strong>
                emails and support messages you send to us.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How we use your information</h2>
            <p>
              We use your information to operate the service, personalize
              recommendations, process order tracking, send service updates,
              improve security, and communicate with you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Sharing and third parties</h2>
            <p>
              We do not sell your personal data. We share limited information
              with service providers (hosting, analytics, email) and may redirect
              you to third-party marketplaces when you choose to buy a product.
              Those marketplaces have their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Cookies and analytics</h2>
            <p>
              We use cookies and similar technologies to remember your session,
              store preferences, and understand usage patterns. You can manage
              cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Security and retention</h2>
            <p>
              We apply reasonable technical and organizational measures to
              protect your data. We retain data only as long as necessary for
              the purposes described or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Your rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct,
              delete, or restrict processing of your personal data. Contact us
              to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post
              the revised version with a new effective date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Contact us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us
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
