import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/store/LegalPageLayout";

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
      { property: "og:url", content: "/privacy-policy" },
      { property: "og:site_name", content: "PasarPilih" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/privacy-policy" }],
  }),
  component: PrivacyPolicyPage,
});

const company = "PT RAFA KPT";
const brand = "PasarPilih";
const email = "adin@inipilihanku.com";
const address = "DS. LAHAR RT3 RW1";

function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      heading="Privacy Policy"
      lead={`Maintained by ${company} for ${brand}. It explains how we collect, use, and protect your personal information.`}
    >
      <section>
        <h2 className="!mt-0">1. Introduction</h2>
        <p className="mt-2">
          {company} (“we”, “us”, or “our”) operates {brand} and respects your
          privacy. This Privacy Policy explains how we collect, use, store,
          share, and protect your personal information when you visit our website
          or use our services.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <ul className="mt-2">
          <li>
            <strong className="text-foreground">Account data:</strong> name, email
            address, phone number, password hash, and shipping address when you
            register or place an order.
          </li>
          <li>
            <strong className="text-foreground">Order data:</strong> products
            purchased, payment confirmation, shipping details, order tracking
            number, and communication related to your order.
          </li>
          <li>
            <strong className="text-foreground">Activity data:</strong> pages
            viewed, products clicked, searches, wishlist, cart items, and order
            tracking requests.
          </li>
          <li>
            <strong className="text-foreground">Device data:</strong> browser
            type, IP address, device identifiers, and approximate location used
            for security, fraud prevention, and service improvement.
          </li>
          <li>
            <strong className="text-foreground">Communication data:</strong>{" "}
            emails, support messages, and survey responses you send to us.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. How we use your information</h2>
        <p className="mt-2">
          We use your information to process orders, manage payments and
          shipping, provide customer support, personalize product
          recommendations, send service updates, prevent fraud, comply with legal
          obligations, and improve our website and services.
        </p>
      </section>

      <section>
        <h2>4. Sharing and third parties</h2>
        <p className="mt-2">
          We do not sell your personal data. We may share limited data with
          trusted service providers who help us operate the service, such as
          payment gateways, shipping/logistics providers, hosting providers,
          analytics services, and email service providers. We may also redirect
          you to partner marketplaces (Shopee, Tokopedia, TikTok Shop) when you
          choose to buy through their platform. Those marketplaces have their own
          privacy policies.
        </p>
      </section>

      <section>
        <h2>5. Cookies and analytics</h2>
        <p className="mt-2">
          We use cookies and similar technologies to keep you signed in, remember
          your preferences, store cart and wishlist items, and understand how
          visitors use our website. You can manage cookies through your browser
          settings. Disabling cookies may affect some features.
        </p>
      </section>

      <section>
        <h2>6. Security and retention</h2>
        <p className="mt-2">
          We apply reasonable technical and organizational security measures to
          protect your data. We retain personal data for as long as necessary to
          fulfill the purposes described in this policy, comply with legal
          obligations, resolve disputes, and enforce our agreements.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p className="mt-2">
          Depending on your location, you may have the right to access, correct,
          delete, restrict, or object to the processing of your personal data, and
          to request a copy of the data we hold about you. To exercise these
          rights, contact us at{" "}
          <a href={`mailto:${email}`} className="text-primary hover:underline">
            {email}
          </a>
          .
        </p>
      </section>

      <section>
        <h2>8. Changes to this policy</h2>
        <p className="mt-2">
          We may update this Privacy Policy from time to time. We will post the
          revised version with an updated effective date. Continued use of the
          service after changes means you accept the revised policy.
        </p>
      </section>

      <section>
        <h2>9. Contact us</h2>
        <p className="mt-2">
          If you have questions about this Privacy Policy or how we handle your
          data, please contact us at{" "}
          <a href={`mailto:${email}`} className="text-primary hover:underline">
            {email}
          </a>{" "}
          or write to us at {address}.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Last updated: {new Date().getFullYear()}
      </p>
    </LegalPageLayout>
  );
}
