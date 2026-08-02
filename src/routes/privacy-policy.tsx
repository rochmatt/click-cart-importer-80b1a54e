import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ChatFab } from "@/components/store/ChatFab";

const title = "Privacy Policy — PasarPilih";
const description =
  "Read the PasarPilih Privacy Policy to understand how PT RAFA KPT collects, uses, and protects your personal information.";

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

const company = "PT RAFA KPT";
const brand = "PasarPilih";
const email = "adin@inipilihanku.com";
const address = "DS. LAHAR RT3 RW1";

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
          This page is maintained by {company} as the privacy policy for {brand}.
          It is a template and should be reviewed by qualified legal counsel
          before publication.
        </p>

        <article className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>
              {company} (“we”, “us”, or “our”) operates {brand} and respects your
              privacy. This Privacy Policy explains how we collect, use, store,
              share, and protect your personal information when you visit our
              website or use our services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Information we collect</h2>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>
                <strong className="text-foreground">Account data:</strong>{" "}
                name, email address, phone number, password hash, and shipping
                address when you register or place an order.
              </li>
              <li>
                <strong className="text-foreground">Order data:</strong>{" "}
                products purchased, payment confirmation, shipping details, order
                tracking number, and communication related to your order.
              </li>
              <li>
                <strong className="text-foreground">Activity data:</strong>{" "}
                pages viewed, products clicked, searches, wishlist, cart items, and
                order tracking requests.
              </li>
              <li>
                <strong className="text-foreground">Device data:</strong>{" "}
                browser type, IP address, device identifiers, and approximate
                location used for security, fraud prevention, and service
                improvement.
              </li>
              <li>
                <strong className="text-foreground">Communication data:</strong>{" "}
                emails, support messages, and survey responses you send to us.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How we use your information</h2>
            <p>
              We use your information to process orders, manage payments and
              shipping, provide customer support, personalize product
              recommendations, send service updates, prevent fraud, comply with
              legal obligations, and improve our website and services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Sharing and third parties</h2>
            <p>
              We do not sell your personal data. We may share limited data with
              trusted service providers who help us operate the service, such as
              payment gateways, shipping/logistics providers, hosting providers,
              analytics services, and email service providers. We may also
              redirect you to partner marketplaces (Shopee, Tokopedia, TikTok
              Shop) when you choose to buy through their platform. Those
              marketplaces have their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Cookies and analytics</h2>
            <p>
              We use cookies and similar technologies to keep you signed in,
              remember your preferences, store cart and wishlist items, and
              understand how visitors use our website. You can manage cookies
              through your browser settings. Disabling cookies may affect some
              features.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Security and retention</h2>
            <p>
              We apply reasonable technical and organizational security measures
              to protect your data. We retain personal data for as long as
              necessary to fulfill the purposes described in this policy, comply
              with legal obligations, resolve disputes, and enforce our agreements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Your rights</h2>
            <p>
              Depending on your location, you may have the right to access,
              correct, delete, restrict, or object to the processing of your
              personal data, and to request a copy of the data we hold about you.
              To exercise these rights, contact us at{" "}
              <a href={`mailto:${email}`} className="text-primary hover:underline">
                {email}
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post
              the revised version with an updated effective date. Continued use
              of the service after changes means you accept the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Contact us</h2>
            <p>
              If you have questions about this Privacy Policy or how we handle
              your data, please contact us at{" "}
              <a href={`mailto:${email}`} className="text-primary hover:underline">
                {email}
              </a>{" "}
              or write to us at {address}.
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
