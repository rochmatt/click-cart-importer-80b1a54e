import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";
import { ChatFab } from "@/components/store/ChatFab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MapPin, Clock } from "lucide-react";

const title = "Contact Us — PasarPilih";
const description =
  "Contact PT RAFA KPT, the operator of PasarPilih, for questions about orders, tracking, payments, returns, or partnerships.";

export const Route = createFileRoute("/contact")({
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
  component: ContactPage,
});

const supportEmail = "adin@inipilihanku.com";
const supportHours = "07:00 – 00:00";
const officeAddress = "DS. LAHAR RT3 RW1";

function ContactPage() {
  const [query, setQuery] = useState("");
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
          Contact us
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          This page is maintained by PT RAFA KPT. Our support team is available
          during the hours listed below. Response times may vary based on inquiry
          volume.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold text-foreground">Email</h2>
            <a
              href={`mailto:${supportEmail}`}
              className="mt-1 break-words text-sm text-primary hover:underline"
            >
              {supportEmail}
            </a>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold text-foreground">Support hours</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {supportHours} WIB
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:col-span-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold text-foreground">Office</h2>
            <p className="mt-1 text-sm text-muted-foreground">{officeAddress}</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Send a message</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
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
      </main>

      <Footer />
      <ChatFab />
      <MobileBottomNav />
    </div>
  );
}
