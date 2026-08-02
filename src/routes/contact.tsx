import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Clock, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LegalPageLayout } from "@/components/store/LegalPageLayout";

const title = "Contact Us — PasarPilih";
const description =
  "Contact PT RAFA KPT (PasarPilih) for support with orders, payments, shipping, returns, or partnership inquiries.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "/contact" },
      { property: "og:site_name", content: "PasarPilih" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

const supportEmail = "adin@inipilihanku.com";
const supportHours = "07:00 – 00:00";
const officeAddress = "DS. LAHAR RT3 RW1";

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`,
    );
    const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent(
      form.subject || "Contact form - PasarPilih",
    )}&body=${body}`;
    window.location.href = mailto;
  };

  return (
    <LegalPageLayout
      heading="Contact us"
      lead="Our support team at PT RAFA KPT is available during the hours listed below. Response times may vary based on inquiry volume."
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="!mt-3 text-sm font-semibold text-foreground">Email</h2>
          <a
            href={`mailto:${supportEmail}`}
            className="mt-1 block break-words text-sm text-primary hover:underline"
          >
            {supportEmail}
          </a>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="!mt-3 text-sm font-semibold text-foreground">Support hours</h2>
          <p className="mt-1 text-sm text-muted-foreground">{supportHours} WIB</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:col-span-2 sm:p-5">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="!mt-3 text-sm font-semibold text-foreground">Office</h2>
          <p className="mt-1 text-sm text-muted-foreground">{officeAddress}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-10 space-y-4">
        <h2 className="!mt-0">Send a message</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              className="h-11"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              className="h-11"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            className="h-11"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="How can we help?"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Tell us more about your question..."
            rows={5}
            required
          />
        </div>

        <Button type="submit" className="h-11 w-full sm:w-auto">
          Open email client
        </Button>
        <p className="text-xs text-muted-foreground">
          This opens your default email app. If it does not open, you can copy{" "}
          <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
            {supportEmail}
          </a>{" "}
          manually.
        </p>
      </form>
    </LegalPageLayout>
  );
}
