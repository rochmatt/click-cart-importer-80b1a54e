import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCatalog } from "@/lib/catalog";
import {
  cartSubtotal,
  formatIDR,
  parsePrice,
  removeFromCart,
  setCartQty,
  useCart,
  addToCart,
  type CartItem,
} from "@/lib/cart";
import { computeTotals, validatePromo, type Promo } from "@/lib/commerce-pricing";
import { buyerFieldsSchema, placeOrder } from "@/lib/commerce.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    product: typeof search.product === "string" ? search.product : undefined,
    qty: Number(search.qty) > 0 ? Number(search.qty) : 1,
  }),
  head: () => {
    const title = "Checkout — PasarPilih";
    const description =
      "Review your cart, enter your shipping details, apply a voucher and place your order on PasarPilih.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: CheckoutPage,
});

type FieldErrors = Partial<Record<string, string>>;

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary";

function CheckoutPage() {
  const { product: productId, qty } = Route.useSearch();
  const navigate = useNavigate();
  const { products } = useCatalog();
  const items = useCart();
  const { user } = useAuth();

  // "Buy now" deep links preselect a product by dropping it into the cart.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !productId) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setSeeded(true);
    if (!items.some((i) => i.id === product.id)) {
      addToCart(
        {
          id: product.id,
          title: product.title,
          price: product.price,
          image: product.images[0] ?? "",
        },
        Math.max(1, qty),
      );
    }
  }, [seeded, productId, products, items, qty]);

  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    notes: "",
    paymentMethod: "cod" as "cod" | "bank_transfer" | "ewallet",
    notify: true,
  });

  useEffect(() => {
    if (user?.email && !form.email) setForm((f) => ({ ...f, email: user.email! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const subtotal = useMemo(() => cartSubtotal(items), [items]);
  const totals = computeTotals(subtotal, promo);

  const setField = (key: keyof typeof form, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const applyPromo = () => {
    const result = validatePromo(promoInput, subtotal);
    if ("error" in result) {
      setPromo(null);
      setPromoError(result.error);
      toast.error(result.error);
      return;
    }
    setPromo(result.promo);
    setPromoError(null);
    toast.success(`Promo ${result.promo.code} applied — ${result.promo.label.toLowerCase()}.`);
  };

  const removePromo = () => {
    setPromo(null);
    setPromoInput("");
    setPromoError(null);
  };

  const validateForm = () => {
    // Skema yang SAMA dengan server (placeOrder) → validasi klien & server selalu
    // selaras; error muncul di field yang tepat, bukan toast generik dari server.
    const parsed = buyerFieldsSchema.safeParse({
      email: form.email,
      name: form.name,
      phone: form.phone,
      address: form.address,
      city: form.city,
      postalCode: form.postalCode,
      notes: form.notes,
    });
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const next: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (key && !next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return false;
  };

  const submit = async () => {
    if (items.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }
    if (!validateForm()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (promo) {
      const recheck = validatePromo(promo.code, subtotal);
      if ("error" in recheck) {
        setPromo(null);
        setPromoError(`${recheck.error} It has been removed from your order.`);
        toast.error(recheck.error);
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await placeOrder({
        data: {
          items: items.map((i: CartItem) => ({
            productRef: i.id,
            title: i.title,
            image: i.image,
            unitPrice: parsePrice(i.price),
            qty: i.qty,
          })),
          email: form.email.trim(),
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          postalCode: form.postalCode.trim(),
          notes: form.notes.trim(),
          promoCode: promo?.code ?? "",
          paymentMethod: form.paymentMethod,
          notifyStatusUpdates: form.notify,
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Order ${result.orderNumber} placed — ${formatIDR(result.total)} total.`);
      const email = form.email.trim();
      for (const item of items) removeFromCart(item.id);
      navigate({
        to: "/orders/$orderNumber",
        params: { orderNumber: result.orderNumber },
        search: { email },
      });
    } catch {
      toast.error("Something went wrong placing your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary font-sans antialiased">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue shopping
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Checkout
        </h1>

        {items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div className="space-y-6">
              {/* Cart lines */}
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground">Your items ({items.length})</h2>
                <ul className="mt-4 divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-3 py-3">
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/products/$id"
                          params={{ id: item.id }}
                          className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-1 text-sm font-semibold text-primary">{item.price}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="inline-flex items-center rounded-full border border-border">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => setCartQty(item.id, item.qty - 1)}
                              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-primary"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-7 text-center text-sm font-semibold">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => setCartQty(item.id, item.qty + 1)}
                              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-primary"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-foreground">
                        {formatIDR(parsePrice(item.price) * item.qty)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Shipping details */}
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground">Shipping details</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fields marked <span className="font-semibold text-destructive">*</span> are
                  required so we can deliver your order.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Email" error={errors.email} required className="sm:col-span-2">
                    <input
                      type="email"
                      required
                      aria-required="true"
                      aria-invalid={Boolean(errors.email)}
                      maxLength={255}
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      placeholder="you@email.com"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Recipient name" error={errors.name} required>
                    <input
                      required
                      aria-required="true"
                      aria-invalid={Boolean(errors.name)}
                      maxLength={120}
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder="Full name"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Phone" error={errors.phone} required>
                    <input
                      required
                      aria-required="true"
                      aria-invalid={Boolean(errors.phone)}
                      inputMode="tel"
                      maxLength={30}
                      value={form.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      placeholder="0812xxxxxxx"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Address" error={errors.address} required className="sm:col-span-2">
                    <textarea
                      rows={3}
                      required
                      aria-required="true"
                      aria-invalid={Boolean(errors.address)}
                      maxLength={500}
                      value={form.address}
                      onChange={(e) => setField("address", e.target.value)}
                      placeholder="Street, building, unit"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="City" error={errors.city} required>
                    <input
                      required
                      aria-required="true"
                      aria-invalid={Boolean(errors.city)}
                      maxLength={120}
                      value={form.city}
                      onChange={(e) => setField("city", e.target.value)}
                      placeholder="Jakarta Selatan"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Postal code" error={errors.postalCode}>
                    <input
                      maxLength={12}
                      value={form.postalCode}
                      onChange={(e) => setField("postalCode", e.target.value)}
                      placeholder="12190"
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Order notes (optional)"
                    error={errors.notes}
                    className="sm:col-span-2"
                  >
                    <input
                      maxLength={500}
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      placeholder="Leave at the lobby, call on arrival…"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </section>

              {/* Payment */}
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground">Payment method</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      { id: "cod", label: "Cash on delivery" },
                      { id: "bank_transfer", label: "Bank transfer" },
                      { id: "ewallet", label: "E-wallet" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setField("paymentMethod", option.id)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        form.paymentMethod === option.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.notify}
                    onChange={(e) => setField("notify", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  Email me when the order status changes.
                </label>
              </section>
            </div>

            {/* Summary */}
            <aside className="space-y-4 lg:sticky lg:top-24">
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground">Order summary</h2>

                <div className="mt-4">
                  <label className="text-xs font-semibold text-muted-foreground">Promo code</label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value);
                        setPromoError(null);
                      }}
                      placeholder="e.g. SAVE10"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={applyPromo}
                      className="shrink-0 rounded-xl border border-primary px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      Apply
                    </button>
                  </div>
                  {promoError && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {promoError}
                    </p>
                  )}
                  {promo && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Tag className="h-3.5 w-3.5" />
                      {promo.code} — {promo.label}
                      <button
                        type="button"
                        onClick={removePromo}
                        className="ml-1 underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </p>
                  )}
                </div>

                <dl className="mt-5 space-y-2 text-sm">
                  <Row label="Subtotal" value={formatIDR(totals.subtotal)} />
                  {totals.discount > 0 && (
                    <Row label="Discount" value={`− ${formatIDR(totals.discount)}`} accent />
                  )}
                  <Row
                    label="Shipping"
                    value={totals.shipping === 0 ? "Free" : formatIDR(totals.shipping)}
                  />
                  <div className="flex items-center justify-between border-t border-border pt-3 text-base">
                    <dt className="font-bold text-foreground">Total</dt>
                    <dd className="font-extrabold text-primary">{formatIDR(totals.total)}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Placing order…" : "Place order"}
                </button>

                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Buyer protection on every order
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    Estimated delivery in 2–4 days
                  </p>
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  error,
  className = "",
  required = false,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-muted-foreground">
        {label}
        {required && (
          <span className="ml-0.5 font-semibold text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={accent ? "font-semibold text-primary" : "font-semibold text-foreground"}>
        {value}
      </dd>
    </div>
  );
}
