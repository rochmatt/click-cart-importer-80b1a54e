export interface MarketplaceLinks {
  shopee: string;
  tokopedia: string;
  tiktok: string;
}

export interface OrderSummary {
  orderNumber: string;
  status: string;
  total: number;
  quantity: number;
  createdAt: string;
  productName: string;
  courier: string | null;
  trackingNumber: string | null;
  etaDate: string | null;
}

export interface OrderItem {
  productRef: string;
  title: string;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDetail extends OrderSummary {
  subtotal: number;
  discount: number;
  shippingFee: number;
  promoCode: string;
  paymentMethod: string;
  destinationCity: string | null;
  lastUpdate: string | null;
  shipping: { name: string; phone: string; address: string; postalCode: string };
  items: OrderItem[];
}

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; total: number }
  | { ok: false; error: string };

export type OrderDetailResult =
  | { ok: true; order: OrderDetail }
  | { ok: false; reason: "not_found" | "forbidden" };

export type ResendConfirmationResult =
  | { ok: true; email: string }
  | {
      ok: false;
      reason: "not_found" | "forbidden" | "no_email" | "cooldown" | "suppressed" | "send_failed";
      retryAfterSeconds?: number;
    };

export interface OrderEmailEvent {
  timestamp: string;
  type: string;
  status: string | null;
}

export type OrderEmailHistoryResult =
  | {
      ok: true;
      email: string;
      /** Last time a confirmation resend was requested in this runtime, if any. */
      lastResendAt: string | null;
      events: OrderEmailEvent[];
      /** Oldest timestamp the plan's retention window exposes. */
      historyStartsAt: string | null;
      /** True when delivery logs could not be read (e.g. email not configured). */
      unavailable?: boolean;
    }
  | { ok: false; reason: "not_found" | "forbidden" | "no_email" };
