import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MailWarning,
  RefreshCw,
} from "lucide-react";
import { getOrderEmailHistory } from "@/lib/commerce.functions";

export const orderEmailHistoryKey = (orderNumber: string, email?: string) => [
  "order-email-history",
  orderNumber,
  email ?? "",
];

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "";
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const EVENT_META: Record<
  string,
  { label: string; icon: typeof Mail; tone: string; hint: string }
> = {
  sent: {
    label: "Handed to the mail provider",
    icon: CheckCircle2,
    tone: "text-emerald-600",
    hint: "Accepted for delivery",
  },
  rejected: {
    label: "Rejected by the mail provider",
    icon: AlertTriangle,
    tone: "text-destructive",
    hint: "Not delivered",
  },
  bounced: {
    label: "Bounced",
    icon: MailWarning,
    tone: "text-destructive",
    hint: "The inbox refused this message",
  },
  complained: {
    label: "Marked as spam",
    icon: MailWarning,
    tone: "text-amber-600",
    hint: "Reported by the recipient",
  },
  unsubscribed: {
    label: "Unsubscribed",
    icon: Ban,
    tone: "text-amber-600",
    hint: "No further emails will be sent",
  },
  suppressed: {
    label: "Blocked before sending",
    icon: Ban,
    tone: "text-destructive",
    hint: "Address is on the suppression list",
  },
  rate_limited: {
    label: "Delayed by rate limits",
    icon: Clock,
    tone: "text-amber-600",
    hint: "Sending allowance reached",
  },
};

export function useOrderEmailHistory(orderNumber: string, email?: string) {
  const fetchHistory = useServerFn(getOrderEmailHistory);
  return useQuery({
    queryKey: orderEmailHistoryKey(orderNumber, email),
    queryFn: () => fetchHistory({ data: { orderNumber, email } }),
    staleTime: 15_000,
  });
}

interface Props {
  orderNumber: string;
  email?: string;
}

export function OrderEmailHistory({ orderNumber, email }: Props) {
  const historyQuery = useOrderEmailHistory(orderNumber, email);

  const data = historyQuery.data;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <Mail className="h-4 w-4" />
            Email delivery history
          </h2>
          {data?.ok && (
            <p className="mt-1 text-xs text-muted-foreground">
              Notifications for this order go to {data.email}.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => historyQuery.refetch()}
          disabled={historyQuery.isFetching}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${historyQuery.isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {historyQuery.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading delivery history…
        </p>
      ) : !data ? (
        <p className="mt-4 text-sm text-muted-foreground">
          We couldn't load the delivery history right now.
        </p>
      ) : !data.ok ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {data.reason === "no_email"
            ? "This order has no email address on file."
            : "Sign in with the account used at checkout to see email delivery history."}
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">
            <p className="font-semibold text-foreground">Last confirmation resend</p>
            <p className="text-muted-foreground">
              {data.lastResendAt
                ? `${formatWhen(data.lastResendAt)} · ${relative(data.lastResendAt)}`
                : "No resend requested from this page yet."}
            </p>
          </div>

          {data.unavailable ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Delivery results aren't available for this order yet.
            </p>
          ) : data.events.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No delivery events recorded yet. Emails sent from the preview build can take a few
              minutes to appear.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.events.map((event, index) => {
                const meta = EVENT_META[event.type] ?? {
                  label: event.type.replace(/_/g, " "),
                  icon: Mail,
                  tone: "text-muted-foreground",
                  hint: "",
                };
                const Icon = meta.icon;
                return (
                  <li key={`${event.timestamp}-${index}`} className="flex items-start gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tone}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(event.timestamp)} · {relative(event.timestamp)}
                        {event.status ? ` · ${event.status}` : meta.hint ? ` · ${meta.hint}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Opens and reads aren't tracked — only sends, bounces, complaints and blocks are
            recorded.
            {data.historyStartsAt
              ? ` History available from ${formatWhen(data.historyStartsAt)}.`
              : ""}
          </p>
        </>
      )}
    </section>
  );
}
