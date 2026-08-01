import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,

  Package,
  PackageSearch,
  Search,
  Truck,
} from "lucide-react";
import { z } from "zod";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  lookupOrder,
  setOrderNotifyPreference,
  type OrderLookupResult,
} from "@/lib/orders.functions";


const title = "Track Your Order — PasarPilih";
const description =
  "Enter your order number (and email if needed) to see the latest shipment status, courier, tracking number and estimated delivery date.";

const searchSchema = z.object({
  order: z.string().trim().max(40).optional(),
});

const inputSchema = z
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


export const Route = createFileRoute("/track")({
  validateSearch: searchSchema,
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
  component: TrackPage,
});

const STEPS = [
  { key: "processing", label: "Order processed", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "in_transit", label: "In transit", icon: MapPin },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

function stepIndex(status: string) {
  const s = status.toLowerCase().replace(/[\s-]/g, "_");
  const i = STEPS.findIndex((x) => x.key === s);
  if (i >= 0) return i;
  if (s.includes("deliver")) return 3;
  if (s.includes("transit") || s.includes("out_for")) return 2;
  if (s.includes("ship") || s.includes("packed") || s.includes("pack")) return 1;
  return 0;
}

function statusTone(status: string) {
  const i = stepIndex(status);
  if (i === 3) return "bg-tokopedia/10 text-tokopedia border-tokopedia/20";
  if (i === 0) return "bg-muted text-muted-foreground border-border";
  return "bg-primary/10 text-primary border-primary/20";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function TrackPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(search.order ?? "");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    orderNumber: string;
    email?: string;
  } | null>(search.order ? { orderNumber: search.order } : null);

  const lookup = useServerFn(lookupOrder);
  const savePreference = useServerFn(setOrderNotifyPreference);
  const queryClient = useQueryClient();
  const [savingPref, setSavingPref] = useState(false);


  const {
    data: result = null,
    isFetching,
    dataUpdatedAt,
    error: queryError,
  } = useQuery({
    queryKey: ["order-lookup", submitted?.orderNumber, submitted?.email ?? ""],
    queryFn: () => lookup({ data: submitted! }) as Promise<OrderLookupResult>,
    enabled: Boolean(submitted),
    refetchInterval: (q: Query<OrderLookupResult>) => {
      const d = q.state.data as OrderLookupResult | undefined;
      if (!d?.found) return false;
      return stepIndex(d.order.status) === 3 ? false : 30_000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const runLookup = (raw: string, push = true, rawEmail = "") => {
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) {
      setSubmitted(null);
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);

    let checkedEmail: string | undefined;
    if (rawEmail.trim()) {
      const parsedEmail = emailSchema.safeParse(rawEmail);
      if (!parsedEmail.success) {
        setEmailError(parsedEmail.error.issues[0].message);
        return;
      }
      checkedEmail = parsedEmail.data;
    }
    setEmailError(null);

    if (push) navigate({ search: { order: parsed.data }, replace: true });
    setSubmitted({ orderNumber: parsed.data, email: checkedEmail });
  };

  const order = result?.found ? result.order : null;
  const verified = Boolean(result?.found && result.verified);
  const active = order ? stepIndex(order.status) : -1;
  const mismatch = result && !result.found && result.reason === "email_mismatch";
  const isPending = isFetching && !result;

  const togglePreference = async (enabled: boolean) => {
    if (!submitted?.email) return;
    setSavingPref(true);
    try {
      const res = await savePreference({
        data: { orderNumber: submitted.orderNumber, email: submitted.email, enabled },
      });
      if (!res.ok) {
        toast.error("We couldn't update your notification preference.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["order-lookup"] });
      toast.success(
        enabled
          ? "You'll get email updates for this order."
          : "Unsubscribed — no more emails for this order.",
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSavingPref(false);
    }
  };

  const lastChecked = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;


  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to shopping
        </Link>

        <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Track your order
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the order number from your confirmation (for example{" "}
          <span className="font-medium text-foreground">INV/2026/07/2841</span>). You can
          also add the email used at checkout to confirm it&apos;s your order.
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            runLookup(value, true, email);
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Order number, e.g. INV/2026/07/2841"
                aria-label="Order number"
                aria-invalid={Boolean(error)}
                className="h-11 pl-9"
              />
            </div>
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Email (optional)"
                aria-label="Email used at checkout (optional)"
                aria-invalid={Boolean(emailError)}
                className="h-11 pl-9"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="h-11 w-full sm:w-40"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Checking
              </>
            ) : (
              "Track order"
            )}
          </Button>
        </form>

        {queryError && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            We couldn&apos;t reach the tracking service. Please try again.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {emailError && (
          <p role="alert" className="mt-1 text-sm font-medium text-destructive">
            {emailError}
          </p>
        )}

        {result && !result.found && !isPending && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <PackageSearch className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">
              {mismatch ? "Details don't match" : "No order found"}
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {mismatch
                ? "That order number exists, but the email doesn't match our records. Try the email used at checkout, or leave it blank."
                : "We couldn't find an order matching that number. Double-check the spelling, or contact support via the chat button."}
            </p>
          </div>
        )}


        {order && (
          <section className="mt-8 space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Order number
                  </p>
                  <p className="text-lg font-bold">{order.order_number}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={statusTone(order.status)}>
                    {formatStatus(order.status)}
                  </Badge>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {isFetching ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Refreshing…
                      </>
                    ) : active === 3 ? (
                      "Delivered — live updates stopped"
                    ) : (
                      `Auto-updating${lastChecked ? ` · last checked ${lastChecked}` : ""}`
                    )}
                  </span>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Product</dt>
                  <dd className="mt-0.5 font-medium">
                    {order.product_name}{" "}
                    <span className="text-muted-foreground">× {order.quantity}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Courier</dt>
                  <dd className="mt-0.5 font-medium">{order.courier ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tracking number</dt>
                  <dd className="mt-0.5 font-medium">{order.tracking_number ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Destination</dt>
                  <dd className="mt-0.5 font-medium">{order.destination_city ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Estimated delivery</dt>
                  <dd className="mt-0.5 font-medium">{order.eta_date ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Latest update</dt>
                  <dd className="mt-0.5 font-medium">{order.last_update ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <BellRing className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold">Email updates</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get an email when this order is shipped, in transit, or delivered.
                  </p>

                  {verified ? (
                    <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 px-4 py-3">
                      <Label
                        htmlFor="notify-status"
                        className="text-sm font-medium leading-snug"
                      >
                        Order status update emails
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          {order.notify_status_updates
                            ? "On — we'll email you at each step"
                            : "Off — you're unsubscribed from this order"}
                        </span>
                      </Label>
                      <div className="flex items-center gap-2">
                        {savingPref && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          id="notify-status"
                          checked={order.notify_status_updates}
                          disabled={savingPref}
                          onCheckedChange={togglePreference}
                          aria-label="Order status update emails"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                      Add the email you used at checkout in the form above to manage or
                      unsubscribe from these updates.
                    </p>
                  )}

                  <Link
                    to="/unsubscribe"
                    search={{ order: order.order_number, email: submitted?.email }}
                    className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    Choose shipped-only updates or unsubscribe
                  </Link>

                </div>
              </div>
            </div>



            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-sm font-semibold">Shipment progress</h2>
              <ol className="mt-5 space-y-0">
                {STEPS.map(({ key, label, icon: Icon }, i) => {
                  const done = i <= active;
                  return (
                    <li key={key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors ${
                            done
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-secondary text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {i < STEPS.length - 1 && (
                          <span
                            className={`w-px flex-1 ${
                              i < active ? "bg-primary" : "bg-border"
                            }`}
                          />
                        )}
                      </div>
                      <div className={`pb-6 ${i === STEPS.length - 1 ? "pb-0" : ""}`}>
                        <p
                          className={`text-sm font-medium ${
                            done ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {label}
                        </p>
                        {i === active && order.last_update && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {order.last_update}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
