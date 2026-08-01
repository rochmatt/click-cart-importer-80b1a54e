import { sendTemplateEmail } from "./email-templates/send-email";

const SITE_URL = (
  process.env.SITE_URL || "https://project--409a8bb6-a93d-47e3-97f5-8ea6dbae285d.lovable.app"
).replace(/\/$/, "");

export function trackingUrl(orderNumber: string) {
  return `${SITE_URL}/track?order=${encodeURIComponent(orderNumber)}`;
}

/** Canonical order detail page — the CTA target used in every status email. */
export function orderUrl(orderNumber: string) {
  return `${SITE_URL}/orders/${encodeURIComponent(orderNumber)}`;
}

/** Copy shown for each shipment status we notify about. */
const STATUS_COPY: Record<string, { headline: string; message: string }> = {
  confirmed: {
    headline: "Your order is confirmed ✅",
    message: "We've received your order and it's now queued for packing.",
  },
  processing: {
    headline: "We're preparing your order 📦",
    message: "Your order is being packed and will be handed to the courier shortly.",
  },
  packed: {
    headline: "Your order is packed 📦",
    message: "Everything is boxed up and waiting for pickup by the courier.",
  },
  shipped: {
    headline: "Your order is on the way 🚚",
    message: "Your parcel has left our warehouse and is now with the courier.",
  },
  in_transit: {
    headline: "Your parcel is in transit ✈️",
    message: "The courier is moving your parcel closer to you.",
  },
  out_for_delivery: {
    headline: "Out for delivery today 🛵",
    message: "The courier is on the final leg — please keep your phone nearby.",
  },
  delivered: {
    headline: "Delivered — enjoy! 🎉",
    message: "Your order has been delivered. Thanks for shopping with PasarPilih.",
  },
  cancelled: {
    headline: "Your order was cancelled",
    message: "This order has been cancelled and will not be shipped.",
  },
  refund_requested: {
    headline: "We received your refund request",
    message: "Your refund request is being reviewed — we'll confirm the outcome shortly.",
  },
  refund_approved: {
    headline: "Your refund is approved ✅",
    message: "We've approved your refund and it's now being processed.",
  },
  refund_processing: {
    headline: "Your refund is on its way 💸",
    message: "We've released your refund back to your original payment method.",
  },
  refunded: {
    headline: "Your refund is complete 🎉",
    message: "Your refund has been sent. It may take a few days to appear in your account.",
  },
  refund_rejected: {
    headline: "We couldn't approve this refund",
    message: "After reviewing your request, we were unable to approve a refund for this order.",
  },
};

/** Statuses handled by the dedicated cancellation email. */
const CANCELLATION_STATUSES = new Set(["cancelled", "canceled"]);

/** Statuses handled by the dedicated refund email. */
const REFUND_STATUSES = new Set([
  "refund_requested",
  "refund_approved",
  "refund_processing",
  "refunded",
  "refund_rejected",
]);

export function isCancellationStatus(status: string) {
  return CANCELLATION_STATUSES.has(status);
}

export function isRefundStatus(status: string) {
  return REFUND_STATUSES.has(status);
}

/** Picks which transactional template a status change should use. */
export function templateForStatus(status: string) {
  if (isCancellationStatus(status)) return "order-cancellation" as const;
  if (isRefundStatus(status)) return "order-refund-update" as const;
  return "order-status-update" as const;
}

/** Typical time a refund takes to land, per payment method. */
export function refundEta(paymentMethod: string) {
  if (paymentMethod === "ewallet") return "1–3 business days";
  if (paymentMethod === "bank_transfer") return "3–5 business days";
  return "3–7 business days";
}

export function statusCopy(status: string) {
  return (
    STATUS_COPY[status] ?? {
      headline: "Your order status changed",
      message: `Your order is now marked as "${status.replace("_", " ")}".`,
    }
  );
}

/** Statuses a customer is notified about when they chose "shipped updates only". */
const SHIPPED_ONLY = new Set(["shipped", "in_transit", "out_for_delivery", "delivered"]);

export function shouldNotify(level: string, enabled: boolean, status: string) {
  if (!enabled || level === "none") return false;
  // Cancellations and refunds are always important enough to send.
  if (isCancellationStatus(status) || isRefundStatus(status)) return true;
  if (level === "shipped_only") return SHIPPED_ONLY.has(status);
  return true;
}

export interface MarketplaceLinks {
  shopee: string;
  tokopedia: string;
  tiktok: string;
}

export interface ConfirmationEmailInput {
  orderId: string;
  orderNumber: string;
  email: string;
  customerName: string;
  items: { title: string; quantity: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  shippingAddress: string;
  marketplaceLinks?: MarketplaceLinks;
  /** Override so a customer-requested resend isn't deduped against the original send. */
  idempotencyKey?: string;
}

/** Masks an address for UI confirmation: jane.doe@mail.com -> ja••••@mail.com */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(user.length - 2, 2))}@${domain}`;
}

const DEFAULT_MARKETPLACE_LINKS: MarketplaceLinks = {
  shopee: "https://shopee.co.id",
  tokopedia: "https://www.tokopedia.com",
  tiktok: "https://www.tiktok.com/shop",
};

/** Sends the post-checkout confirmation. Never throws — checkout must not fail on email. */
export async function sendOrderConfirmationEmail(
  input: ConfirmationEmailInput,
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const result = await sendTemplateEmail("order-confirmation", input.email, {
      idempotencyKey: input.idempotencyKey ?? `order-confirmation-${input.orderId}`,
      templateData: {
        customerName: input.customerName,
        orderNumber: input.orderNumber,
        maskedEmail: maskEmail(input.email),
        items: input.items,
        subtotal: input.subtotal,
        discount: input.discount,
        shippingFee: input.shippingFee,
        total: input.total,
        paymentMethod: input.paymentMethod,
        shippingAddress: input.shippingAddress,
        trackingUrl: trackingUrl(input.orderNumber),
        marketplaceLinks: input.marketplaceLinks ?? DEFAULT_MARKETPLACE_LINKS,
      },
    });
    if (result && result.sent === false) {
      return { sent: false, reason: result.reason ?? "not_sent" };
    }
    return { sent: true };
  } catch (error) {
    console.error("order confirmation email failed", input.orderNumber, error);
    return { sent: false, reason: (error as { code?: string })?.code ?? "send_failed" };
  }
}

