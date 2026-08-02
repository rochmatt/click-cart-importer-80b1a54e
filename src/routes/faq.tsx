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
  "Find answers to common questions about PasarPilih, order tracking, returns, accounts, and how our product aggregator works.";

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
      "PasarPilih is a product aggregator. We curate products and deals from popular Indonesian marketplaces so you can browse and compare in one place. Purchases are completed on the destination marketplace, not on PasarPilih.",
  },
  {
    question: "Do you handle payments or shipping?",
    answer:
      "No. PasarPilih does not process payments, hold inventory, or ship products. When you click to buy, you are redirected to the seller's marketplace page to complete checkout and delivery arrangements.",
  },
  {
    question: "How do I track my order?",
    answer:
      "Use the Track Order page and enter your order number. You can also add the email used at checkout to verify the order and manage email status updates.",
  },
  {
    question: "Why do prices or availability sometimes change?",
    answer:
      "Prices, stock, and vouchers are controlled by the destination marketplace and the seller. We refresh our catalog regularly, but the live listing on the marketplace is always the final source of truth.",
  },
  {
    question: "Can I return an item I bought?",
    answer:
      "Return and refund policies are set by the seller and the marketplace where you completed the purchase. Please check the marketplace's return policy or contact their support directly for order issues.",
  },
  {
    question: "Do I need an account to use PasarPilih?",
    answer:
      "You can browse products without an account. Creating an account lets you save a wishlist, track orders, and receive personalized recommendations.",
  },
  {
    question: "How do I report a wrong or broken listing?",
    answer:
      "Please contact our support team through the Contact page with the product link or name. We will review the listing and update or remove it when needed.",
  },
  {
    question: "Is my personal data safe?",
    answer:
      "We take data protection seriously. You can read how we collect, use, and store data in our Privacy Policy and Terms of Service. We use industry-standard authentication and secure backend services.",
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
          This page is maintained by PasarPilih to answer common questions about
          the service. If you need more help, please contact support.
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
            and we will get back to you as soon as possible.
          </p>
        </div>
      </main>

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
