import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageCircle,
  X,
  Headphones,
  Send,
  Package,
  Ticket,
  HelpCircle,
  Truck,
  MapPin,
  CalendarClock,
  Hash,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { lookupOrder } from "@/lib/orders.functions";

type Message = {
  id: string;
  from: "bot" | "user";
  text?: string;
  order?: OrderRow;
};

type QuickReply = {
  label: string;
  icon: typeof Package;
  prompt: string;
  reply?: string;
  action?: "order-lookup";
};

const QUICK_REPLIES: QuickReply[] = [
  {
    label: "Order status",
    icon: Package,
    prompt: "Where is my order?",
    action: "order-lookup",
  },
  {
    label: "Vouchers",
    icon: Ticket,
    prompt: "What vouchers can I use?",
    reply:
      "Today you can use SAVE10 (10% off), HEMAT25K (Rp25.000 off, min. Rp100.000) and FREESHIP (free shipping). Just paste the code in the promo field at checkout.",
  },
  {
    label: "Product question",
    icon: HelpCircle,
    prompt: "I have a question about a product.",
    reply:
      "Happy to help! Open the product page and check the Specifications section first — if you still need details on size, warranty or stock, tell me the product name and I'll check for you.",
  },
];

const GREETING: Message = {
  id: "greeting",
  from: "bot",
  text: "Hi! I'm PasarPilih Care. Pick a topic below or type your question.",
};

const ASK_ORDER_NUMBER =
  "Sure — what's your order number? It looks like INV/2026/07/2841 (the last 4 digits work too).";

const STATUS_LABELS: Record<string, string> = {
  processing: "Being prepared by the seller",
  packed: "Packed, waiting for courier pickup",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

type OrderRow = {
  order_number: string;
  product_name: string;
  quantity: number;
  status: string;
  courier: string | null;
  tracking_number: string | null;
  destination_city: string | null;
  eta_date: string | null;
  last_update: string | null;
};

const STATUS_TONE: Record<string, string> = {
  processing: "bg-amber-100 text-amber-700",
  packed: "bg-amber-100 text-amber-700",
  in_transit: "bg-blue-100 text-blue-700",
  out_for_delivery: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
};

function OrderCard({ o }: { o: OrderRow }) {
  const eta = formatDate(o.eta_date);
  const delivered = o.status === "delivered";
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-border bg-muted/60 p-3 text-xs text-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{o.product_name}</p>
          <p className="text-[11px] text-muted-foreground">
            Qty {o.quantity} · {o.order_number}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            STATUS_TONE[o.status] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {STATUS_LABELS[o.status] ?? o.status}
        </span>
      </div>

      <dl className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
        {o.courier && (
          <div className="flex items-center gap-2">
            <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <dt className="sr-only">Courier</dt>
            <dd className="truncate">{o.courier}</dd>
          </div>
        )}
        {o.tracking_number && (
          <div className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <dt className="sr-only">Tracking number</dt>
            <dd className="truncate font-mono text-[11px]">{o.tracking_number}</dd>
          </div>
        )}
        {o.destination_city && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <dt className="sr-only">Destination</dt>
            <dd className="truncate">{o.destination_city}</dd>
          </div>
        )}
        {eta && (
          <div className="flex items-center gap-2">
            {delivered ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-tokopedia" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <dt className="sr-only">{delivered ? "Delivered on" : "Estimated arrival"}</dt>
            <dd>
              {delivered ? "Delivered on" : "Arrives by"} {eta}
            </dd>
          </div>
        )}
      </dl>

      {o.last_update && (
        <p className="mt-2.5 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {o.last_update}
        </p>
      )}
    </div>
  );
}

const ORDER_NUMBER_RE = /^[A-Za-z0-9/\-_]{3,40}$/;

function botAnswer(text: string): string {
  const q = text.toLowerCase();
  if (q.includes("voucher") || q.includes("promo") || q.includes("code"))
    return QUICK_REPLIES[1].reply!;
  if (q.includes("product") || q.includes("spec") || q.includes("size"))
    return QUICK_REPLIES[2].reply!;
  if (q.includes("refund") || q.includes("return"))
    return "Returns are free within 7 days of delivery. Go to My Orders → Request return and pick a reason; we'll send a pickup label.";
  if (q.includes("ship") || q.includes("delivery"))
    return "We ship across Indonesia. Free shipping applies on orders above Rp150.000, and most areas receive their parcel in 1–3 days.";
  return "Thanks for the details! A care agent will follow up here shortly. Meanwhile, the quick topics above cover most questions.";
}

export function ChatFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [awaitingOrderNumber, setAwaitingOrderNumber] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const findOrder = useServerFn(lookupOrder);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, lookingUp, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function pushBot(text: string) {
    setTyping(false);
    setMessages((m) => [...m, { id: `${Date.now()}-b-${Math.random()}`, from: "bot", text }]);
    inputRef.current?.focus();
  }

  function pushOrder(order: OrderRow) {
    setTyping(false);
    setMessages((m) => [
      ...m,
      {
        id: `${Date.now()}-b-intro`,
        from: "bot",
        text: `Here's the latest on order ${order.order_number}:`,
      },
      { id: `${Date.now()}-b-card`, from: "bot", order },
    ]);
    inputRef.current?.focus();
  }

  async function resolveOrder(term: string) {
    if (!ORDER_NUMBER_RE.test(term)) {
      pushBot(
        "Hmm, that doesn't look like an order number. It should look like INV/2026/07/2841 — or just the last 4 digits, e.g. 2841.",
      );
      return;
    }
    setTyping(false);
    setLookingUp(true);
    try {
      const result = await findOrder({ data: { orderNumber: term } });
      setLookingUp(false);
      if (result.found) {
        setAwaitingOrderNumber(false);
        pushOrder(result.order);
      } else {
        pushBot(
          `No luck finding "${term}" — it may have a typo. Check the number on your order confirmation email and send it again, or try just the last 4 digits.`,
        );
      }
    } catch {
      setLookingUp(false);
      pushBot(
        "Sorry, I couldn't reach the order system just now. Give it a moment and send the order number again.",
      );
    }
  }


  function send(text: string, quick?: QuickReply) {
    const value = text.trim();
    if (!value) return;
    setMessages((m) => [...m, { id: `${Date.now()}-u`, from: "user", text: value }]);
    setInput("");
    setTyping(true);

    if (quick?.action === "order-lookup") {
      setAwaitingOrderNumber(true);
      window.setTimeout(() => pushBot(ASK_ORDER_NUMBER), 500);
      return;
    }

    if (quick?.reply) {
      setAwaitingOrderNumber(false);
      window.setTimeout(() => pushBot(quick.reply!), 600);
      return;
    }

    const looksLikeOrder = /inv\//i.test(value) || (awaitingOrderNumber && !value.includes(" "));
    if (looksLikeOrder) {
      void resolveOrder(value.replace(/\s+/g, ""));
      return;
    }

    if (/order|shipment|tracking|package|parcel/i.test(value)) {
      setAwaitingOrderNumber(true);
      window.setTimeout(() => pushBot(ASK_ORDER_NUMBER), 500);
      return;
    }

    const answer = botAnswer(value);
    window.setTimeout(() => pushBot(answer), 700);
  }


  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-4 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div className="animate-in fade-in slide-in-from-bottom-2 flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card-hover)]">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
              <Headphones className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">PasarPilih Care</p>
              <p className="text-[11px] text-tokopedia">Online · replies in ~1 min</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help chat"
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {messages.map((m) => (
              <div key={m.id} className={m.from === "user" ? "flex justify-end" : "flex justify-start"}>
                {m.order ? (
                  <OrderCard o={m.order} />
                ) : (
                  <p
                    className={
                      m.from === "user"
                        ? "max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground"
                        : "max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs leading-relaxed text-foreground"
                    }
                  >
                    {m.text}
                  </p>
                )}
              </div>
            ))}
            {lookingUp && (
              <div className="flex justify-start" aria-live="polite">
                <p className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking the latest shipment update…
                </p>
              </div>
            )}
            {typing && !lookingUp && (
              <div className="flex justify-start">
                <p className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Typing…
                </p>
              </div>
            )}

          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
            {QUICK_REPLIES.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => send(r.prompt, r)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <r.icon className="h-3 w-3" />
                {r.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              aria-label="Message"
              className="h-9 flex-1 rounded-full border border-border bg-background px-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help chat" : "Open help chat"}
        aria-expanded={open}
        className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-brand)] transition-transform hover:scale-105 sm:h-14 sm:w-14"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
