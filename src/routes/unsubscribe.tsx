import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { BellOff, BellRing, CheckCircle2, Loader2, Mail, Truck } from "lucide-react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { setOrderNotifyLevel, type NotifyLevel } from "@/lib/orders.functions";

const title = "Email Preferences — PasarPilih";
const description =
  "Confirm your unsubscribe or choose to receive shipped-only updates instead of every order status email.";

const searchSchema = z.object({
  order: z.string().trim().max(40).optional(),
  email: z.string().trim().max(255).optional(),
});

const orderSchema = z
  .string()
  .trim()
  .min(3, "Order number is too short")
  .max(40, "Order number is too long")
  .regex(/^[A-Za-z0-9/\-_]+$/, "Use only letters, numbers, dashes or slashes");

const emailSchema = z
  .string()
  .trim()
  .max(255, "Email is too long")
  .email("Enter a valid email address");

const OPTIONS: { value: NotifyLevel; label: string; hint: string; icon: typeof Truck }[] = [
  {
    value: "none",
    label: "Unsubscribe from all updates",
    hint: "No more status emails for this order.",
    icon: BellOff,
  },
  {
    value: "shipped_only",
    label: "Shipped updates only",
    hint: "One email when your parcel ships. Nothing else.",
    icon: Truck,
  },
  {
    value: "all",
    label: "Full status updates",
    hint: "Shipped, in transit and delivered notifications.",
    icon: BellRing,
  },
];

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const search = Route.useSearch();
  const [order, setOrder] = useState(search.order ?? "");
  const [email, setEmail] = useState(search.email ?? "");
  const [level, setLevel] = useState<NotifyLevel>("none");
  const [errors, setErrors] = useState<{ order?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);
  const [savedLevel, setSavedLevel] = useState<NotifyLevel | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setOrder(search.order ?? "");
    setEmail(search.email ?? "");
  }, [search.order, search.email]);

  const saveLevel = useServerFn(setOrderNotifyLevel);

  async function confirm() {
    const o = orderSchema.safeParse(order);
    const e = emailSchema.safeParse(email);
    const next: { order?: string; email?: string } = {};
    if (!o.success) next.order = o.error.issues[0].message;
    if (!e.success) next.email = e.error.issues[0].message;
    setErrors(next);
    if (next.order || next.email) return;

    setSaving(true);
    try {
      const res = await saveLevel({
        data: { orderNumber: o.data!, email: e.data!, level },
      });
      if (!res.ok) {
        const msg =
          res.reason === "not_found"
            ? "We couldn't find that order number."
            : "That email doesn't match the one used at checkout.";
        setErrors({
          order: res.reason === "not_found" ? msg : undefined,
          email: res.reason === "email_mismatch" ? msg : undefined,
        });
        toast.error(msg);
        return;
      }
      setSavedLevel(res.level);
      toast.success(
        res.level === "none"
          ? "You're unsubscribed from this order's emails."
          : res.level === "shipped_only"
            ? "You'll only get the shipped notification."
            : "You'll get full status updates.",
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Email preferences</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        {savedLevel ? (
          <div className="mt-8 rounded-xl border bg-muted/40 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 text-lg font-semibold">
              {savedLevel === "none" ? "You're unsubscribed" : "Preference saved"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {savedLevel === "none"
                ? `We won't email you about order ${order.toUpperCase()} anymore.`
                : savedLevel === "shipped_only"
                  ? `We'll only email you when order ${order.toUpperCase()} ships.`
                  : `You'll receive every status update for order ${order.toUpperCase()}.`}
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setSavedLevel(null)}>
                Change preference
              </Button>
              <Button asChild>
                <Link to="/track" search={{ order: order.toUpperCase() }}>
                  Track this order
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6 rounded-xl border p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="unsub-order">Order number</Label>
                <Input
                  id="unsub-order"
                  value={order}
                  placeholder="INV/2026/07/2841"
                  onChange={(e) => setOrder(e.target.value)}
                  aria-invalid={Boolean(errors.order)}
                />
                {errors.order && <p className="text-xs text-destructive">{errors.order}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unsub-email">Checkout email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="unsub-email"
                    type="email"
                    className="pl-9"
                    value={email}
                    placeholder="you@email.com"
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>

            <div className="space-y-3">
              <Label>What would you like to receive?</Label>
              <RadioGroup
                value={level}
                onValueChange={(v) => setLevel(v as NotifyLevel)}
                className="gap-3"
              >
                {OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = level === opt.value;
                  return (
                    <Label
                      key={opt.value}
                      htmlFor={`level-${opt.value}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                        active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem id={`level-${opt.value}`} value={opt.value} className="mt-1" />
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium">{opt.label}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {opt.hint}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

            <Button className="w-full" onClick={confirm} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {level === "none" ? "Confirm unsubscribe" : "Save preference"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              We verify your checkout email so only you can change these settings.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
