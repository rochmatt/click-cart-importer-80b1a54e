import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ChatFab } from "@/components/store/ChatFab";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const title = "FAQ — PasarPilih";
const description =
  "Find answers about PasarPilih orders, payments, shipping, returns, and how we curate products from partner marketplaces.";

export const Route = createFileRoute("/faq")({
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
  component: FAQPage,
});

const faqs = [
  {
    question: "What is PasarPilih?",
    answer:
      "PasarPilih is operated by PT RAFA KPT. We are a product aggregator and direct seller. We curate products from trusted marketplaces such as Shopee, Tokopedia, and TikTok Shop, and for selected items we also process payment and shipping directly.",
  },
  {
    question: "Do you handle payments and shipping?",
    answer:
      "Yes. For products bought directly on PasarPilih, we handle the payment and arrange delivery. For products you click through to a partner marketplace, payment and shipping are handled by that marketplace and its seller.",
  },
  {
    question: "How do I track my order?",
    answer:
      "Use the Track Order page and enter your order number. You can also add the email used at checkout to verify the order and manage email status updates. Orders placed through a partner marketplace should be tracked on that marketplace.",
  },
  {
    question: "Why do prices or availability sometimes change?",
    answer:
      "Prices, stock, and vouchers on partner-marketplace listings are controlled by that marketplace and the seller. We refresh our catalog regularly, but the live listing on the marketplace is always the final source of truth. Direct-sale products on PasarPilih show our own live stock and price.",
  },
  {
    question: "What is your return and refund policy?",
    answer:
      "For direct purchases on PasarPilih, you may request a return within 7 days of receipt if the item is damaged, defective, or incorrect. Refunds are typically processed within 3–5 business days after we receive and inspect the returned item. For purchases made through a partner marketplace, returns and refunds follow that marketplace's policy.",
  },
  {
    question: "Do I need an account to use PasarPilih?",
    answer:
      "You can browse products without an account. Creating an account lets you save a wishlist, track orders, manage email preferences, and receive personalized recommendations.",
  },
  {
    question: "How do I report a wrong or broken listing?",
    answer:
      "Please contact our support team at adin@inipilihanku.com or through the Contact page with the product link or name. We will review the listing and update or remove it when needed.",
  },
  {
    question: "Is my personal data safe?",
    answer:
      "We take data protection seriously. You can read how we collect, use, and store data in our Privacy Policy and Terms of Service. We use industry-standard authentication and secure backend services.",
  },
  {
    question: "When is customer support available?",
    answer:
      "Our support team is available from 07:00 to 00:00 WIB. We aim to respond to email inquiries as quickly as possible, usually within one business day.",
  },
];

function FAQPage() {
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
          Frequently asked questions
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          This page is maintained by PT RAFA KPT to answer common questions about
          PasarPilih. If you need more help, please contact support.
        </p>

        <Accordion type="single" collapsible className="mt-8 w-full">
          {faqs.map(({ question, answer }, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium text-foreground sm:text-base">
                {question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-10 rounded-2xl border border-border bg-secondary/50 p-6">
          <p className="font-medium text-foreground">Still have questions?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reach out via our{" "}
            <Link to="/contact" className="text-primary hover:underline">
              Contact page
            </Link>{" "}
            or email{" "}
            <a
              href="mailto:adin@inipilihanku.com"
              className="text-primary hover:underline"
            >
              adin@inipilihanku.com
            </a>
            .
          </p>
        </div>
      </main>

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
