import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MailCheck,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/cart";
import { getOrderDetail, resendOrderConfirmationEmail } from "@/lib/commerce.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  OrderEmailHistory,
  orderEmailHistoryKey,
  useOrderEmailHistory,
} from "@/components/store/OrderEmailHistory";

const title = "Order Details — PasarPilih";
const description =
  "See line items, totals, current status and courier tracking links for your PasarPilih order.";

export const Route = createFileRoute("/orders/$orderNumber")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderDetailPage,
});

const statusTone: Record<string, string> = {
  processing: "bg-amber-100 text-amber-800",
  packed: "bg-sky-100 text-sky-800",
  shipped: "bg-blue-100 text-blue-800",
  "in transit": "bg-blue-100 text-blue-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

const paymentLabel: Record<string, string> = {
  cod: "Cash on delivery",
  bank_transfer: "Bank transfer",
  ewallet: "E-wallet",
};

function trackingUrl(courier: string | null, tracking: string | null) {
  if (!courier || !tracking) return null;
  const c = courier.toLowerCase();
  if (c.includes("jne")) return `https://www.jne.co.id/tracking-package?code=${tracking}`;
  if (c.includes("j&t") || c.includes("jnt"))
    return `https://www.jet.co.id/track?billcode=${tracking}`;
  if (c.includes("sicepat")) return `https://www.sicepat.com/checkAwb/${tracking}`;
  if (c.includes("anteraja")) return `https://anteraja.id/tracking/${tracking}`;
  if (c.includes("pos")) return `https://www.posindonesia.co.id/id/tracking/${tracking}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${courier} ${tracking}`)}`;
}

function OrderDetailPage() {
  const { orderNumber } = Route.useParams();
  const { email } = Route.useSearch();
  const [query, setQuery] = useState("");
  const fetchOrder = useServerFn(getOrderDetail);

  const queryClient = useQueryClient();

  // Mirrors the 60s server-side resend cooldown so the button can count down.
  const RESEND_COOLDOWN_SECONDS = 60;
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const cooldownLeft = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000)) : 0;

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  // Clear the cooldown as soon as it elapses so the button re-enables itself.
  useEffect(() => {
    if (cooldownUntil && cooldownLeft === 0) setCooldownUntil(null);
  }, [cooldownUntil, cooldownLeft]);

  // Seed from the server-reported last resend so a reload keeps counting down.
  const history = useOrderEmailHistory(orderNumber, email);
  const lastResendAt = history.data?.ok ? history.data.lastResendAt : null;
  useEffect(() => {
    if (!lastResendAt) return;
    const until = new Date(lastResendAt).getTime() + RESEND_COOLDOWN_SECONDS * 1000;
    if (until > Date.now()) setCooldownUntil((prev) => (prev && prev > until ? prev : until));
  }, [lastResendAt]);

  const resendFn = useServerFn(resendOrderConfirmationEmail);
  const resend = useMutation({
    mutationFn: () => resendFn({ data: { orderNumber, email } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: orderEmailHistoryKey(orderNumber, email) });
      if (res.ok) {
        setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
        toast.success("Confirmation email sent", {
          description: `We re-sent your order confirmation to ${res.email}. It can take a minute to arrive — check spam too.`,
        });
        return;
      }
      if (res.reason === "cooldown") {
        setCooldownUntil(Date.now() + (res.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS) * 1000);
      }
      const messages: Record<string, string> = {
        cooldown: `Please wait ${res.retryAfterSeconds ?? 60}s before requesting another email.`,
        no_email: "This order has no email address on file.",
        suppressed: "That address previously unsubscribed or bounced, so we can't email it.",
        forbidden: "Sign in with the account used at checkout to resend this email.",
        not_found: "We couldn't find this order.",
        send_failed: "Something went wrong sending the email. Please try again shortly.",
      };
      toast.error("Email not sent", { description: messages[res.reason] ?? messages.send_failed });
    },
    onError: () =>
      toast.error("Email not sent", { description: "Please check your connection and try again." }),
  });

  const orderQuery = useQuery({
    queryKey: ["order-detail", orderNumber, email ?? ""],
    queryFn: () => fetchOrder({ data: { orderNumber, email } }),
  });

  const result = orderQuery.data;
  const order = result?.ok ? result.order : null;
  const link = order ? trackingUrl(order.courier, order.trackingNumber) : null;

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to="/account"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my orders
        </Link>

        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground">
          Order {orderNumber}
        </h1>

        {orderQuery.isLoading ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your order…
          </p>
        ) : !order ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-semibold text-foreground">
              {result && !result.ok && result.reason === "forbidden"
                ? "This order belongs to another account"
                : "Order not found"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sign in with the account used at checkout, or look it up on the tracking page
              with your email.
            </p>
            <Link
              to="/track"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Track an order
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Placed on{" "}
                    {new Date(order.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {order.quantity} item{order.quantity === 1 ? "" : "s"} ·{" "}
                    {paymentLabel[order.paymentMethod] ?? order.paymentMethod}
                  </p>
                </div>
                <Badge
                  className={`capitalize ${statusTone[order.status.toLowerCase()] ?? "bg-secondary text-foreground"}`}
                >
                  {order.status}
                </Badge>
              </div>

              {order.lastUpdate && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-primary" />
                  {order.lastUpdate}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-foreground">Items</h2>
              <ul className="mt-3 divide-y divide-border">
                {order.items.map((item) => (
                  <li key={item.productRef + item.title} className="flex gap-3 py-3">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                        className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-border bg-secondary">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatIDR(item.unitPrice)} × {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-foreground">
                      {formatIDR(item.lineTotal)}
                    </p>
                  </li>
                ))}
                {order.items.length === 0 && (
                  <li className="py-3 text-sm text-muted-foreground">{order.productName}</li>
                )}
              </ul>

              <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-semibold text-foreground">{formatIDR(order.subtotal)}</dd>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      Discount {order.promoCode && `(${order.promoCode})`}
                    </dt>
                    <dd className="font-semibold text-primary">− {formatIDR(order.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd className="font-semibold text-foreground">
                    {order.shippingFee === 0 ? "Free" : formatIDR(order.shippingFee)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base">
                  <dt className="font-bold text-foreground">Total</dt>
                  <dd className="font-extrabold text-primary">{formatIDR(order.total)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-foreground">Shipping</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">{order.shipping.name}</span>
                    {order.shipping.phone && ` · ${order.shipping.phone}`}
                    <br />
                    {order.shipping.address}
                    {order.destinationCity && `, ${order.destinationCity}`}
                    {order.shipping.postalCode && ` ${order.shipping.postalCode}`}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Truck className="h-4 w-4 shrink-0 text-primary" />
                  {order.courier ? (
                    <span>
                      {order.courier}
                      {order.trackingNumber && ` · ${order.trackingNumber}`}
                    </span>
                  ) : (
                    <span>Courier will be assigned once your order is packed.</span>
                  )}
                </p>
                {order.etaDate && (
                  <p className="text-xs">
                    Estimated arrival{" "}
                    {new Date(order.etaDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/track"
                  search={{ order: order.orderNumber } as never}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary"
                >
                  Track shipment
                </Link>
                <button
                  type="button"
                  onClick={() => resend.mutate()}
                  disabled={resend.isPending || cooldownLeft > 0}
                  aria-live="polite"
                  title={
                    cooldownLeft > 0
                      ? `You can request another email in ${cooldownLeft}s`
                      : undefined
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  {resend.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : cooldownLeft > 0 ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : (
                    <MailCheck className="h-3.5 w-3.5" />
                  )}
                  {cooldownLeft > 0
                    ? `Resend available in ${cooldownLeft}s`
                    : "Resend confirmation email"}
                </button>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Open courier tracking
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </section>

            <OrderEmailHistory orderNumber={orderNumber} email={email} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
