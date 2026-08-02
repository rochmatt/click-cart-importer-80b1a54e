import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/store/LegalPageLayout";

const title = "Terms of Service — PasarPilih";
const description =
  "Read the PasarPilih Terms of Service for the rules, responsibilities, and limitations that apply when using PT RAFA KPT's services.";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "/terms-of-service" },
      { property: "og:site_name", content: "PasarPilih" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/terms-of-service" }],
  }),
  component: TermsOfServicePage,
});

const company = "PT RAFA KPT";
const brand = "PasarPilih";
const email = "adin@inipilihanku.com";
const address = "DS. LAHAR RT3 RW1";

function TermsOfServicePage() {
  return (
    <LegalPageLayout
      heading="Terms of Service"
      lead={`Maintained by ${company} for ${brand}. These terms cover accounts, orders, returns, and liability.`}
    >
      <section>
        <h2 className="!mt-0">1. Acceptance of terms</h2>
        <p className="mt-2">
          By accessing or using {brand}, you agree to these Terms of Service. If
          you do not agree, please do not use the service. These terms are a
          binding agreement between you and {company}.
        </p>
      </section>

      <section>
        <h2>2. About the service</h2>
        <p className="mt-2">
          {brand} is operated by {company}. We offer two types of service: (a)
          direct sales where we list products, process payments, and arrange
          shipping ourselves; and (b) aggregation of products, prices, and deals
          from third-party partner marketplaces such as Shopee, Tokopedia, and
          TikTok Shop. When you click through to a partner marketplace, that
          marketplace's seller processes your order.
        </p>
      </section>

      <section>
        <h2>3. Accounts</h2>
        <p className="mt-2">
          You may create an account to access features like wishlists, order
          tracking, and personalized recommendations. You must provide accurate
          information and keep your credentials secure. You are responsible for
          all activity that occurs under your account.
        </p>
      </section>

      <section>
        <h2>4. Orders, payments, and shipping</h2>
        <p className="mt-2">
          For direct purchases on {brand}, we confirm availability, accept payment
          through supported payment methods, and arrange shipping to the address
          you provide. Delivery times are estimates and may vary based on
          location, courier, and product availability. For partner-marketplace
          purchases, payment, shipping, and delivery are handled by that
          marketplace and its seller.
        </p>
      </section>

      <section>
        <h2>5. Returns and refunds</h2>
        <p className="mt-2">
          For direct {brand} purchases, you may request a return within 7 days of
          receipt if the item is damaged, defective, or not as described. Refunds
          are typically processed within 3–5 business days after we receive and
          inspect the returned item. Return shipping costs may be covered by us
          if the return is due to our error. For partner-marketplace purchases,
          returns and refunds follow that marketplace's policy.
        </p>
      </section>

      <section>
        <h2>6. Marketplace links</h2>
        <p className="mt-2">
          Links to third-party marketplaces are provided for convenience.{" "}
          {company} does not control those sites and is not responsible for their
          content, pricing, availability, policies, or seller actions.
        </p>
      </section>

      <section>
        <h2>7. Prohibited conduct</h2>
        <p className="mt-2">You agree not to:</p>
        <ul className="mt-2">
          <li>use the service for unlawful purposes;</li>
          <li>abuse automation, scraping, or other disruptive tools;</li>
          <li>impersonate another person or misrepresent your identity;</li>
          <li>
            interfere with the security, availability, or integrity of the
            service;
          </li>
          <li>submit false or fraudulent order information.</li>
        </ul>
      </section>

      <section>
        <h2>8. Intellectual property</h2>
        <p className="mt-2">
          {brand} branding, code, design, and content are owned by {company} or
          licensed to us. You may not copy, modify, distribute, or create
          derivative works without our written permission.
        </p>
      </section>

      <section>
        <h2>9. Limitation of liability</h2>
        <p className="mt-2">
          To the fullest extent permitted by law, {company} is not liable for
          indirect, incidental, or consequential damages arising from your use of
          the service or any partner marketplace. For direct purchases, our
          liability is limited to the amount you paid for the affected product.
        </p>
      </section>

      <section>
        <h2>10. Changes to these terms</h2>
        <p className="mt-2">
          We may update these Terms of Service from time to time. We will post the
          revised version with an updated effective date. Continued use of the
          service after changes means you accept the revised terms.
        </p>
      </section>

      <section>
        <h2>11. Contact us</h2>
        <p className="mt-2">
          For questions about these Terms of Service, please contact us at{" "}
          <a href={`mailto:${email}`} className="text-primary hover:underline">
            {email}
          </a>{" "}
          or write to {address}.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Last updated: {new Date().getFullYear()}
      </p>
    </LegalPageLayout>
  );
}
