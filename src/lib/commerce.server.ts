import { computeTotals, findPromo, validatePromo } from "./commerce-pricing";
import type {
  MarketplaceLinks,
  OrderDetail,
  OrderDetailResult,
  OrderEmailHistoryResult,
  OrderSummary,
  PlaceOrderResult,
  ResendConfirmationResult,
} from "./commerce-types";

export interface PlaceOrderData {
  items: { productRef: string; title: string; image: string; unitPrice: number; qty: number }[];
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  notes: string;
  promoCode: string;
  paymentMethod: "cod" | "bank_transfer" | "ewallet";
  notifyStatusUpdates: boolean;
}

function makeOrderNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PP-${stamp}-${rand}`;
}

/**
 * Pembeli yang sedang masuk, atau null untuk tamu.
 *
 * Dulu membaca JWT Supabase dari header Authorization yang dilampirkan
 * middleware klien. Kini identitas datang dari cookie sesi httpOnly, yang
 * dikirim browser sendiri — tidak ada lagi header yang perlu dilampirkan, dan
 * token tidak lagi terbaca JavaScript.
 *
 * Tetap mengembalikan null alih-alih melempar: checkout harus tetap bisa
 * dilakukan tamu.
 */
export async function currentUserId(): Promise<string | null> {
  const { getSessionUser } = await import("@/lib/auth/session.server");
  return (await getSessionUser())?.id ?? null;
}

const DEFAULT_MARKETPLACE_LINKS: MarketplaceLinks = {
  shopee: "https://shopee.co.id",
  tokopedia: "https://www.tokopedia.com",
  tiktok: "https://www.tiktok.com/shop",
};

// Parameter supabaseAdmin dihapus: admin_products kini dibaca dari PostgreSQL
// lokal, sementara orders dan order_items masih di Supabase. Selama keduanya
// terpisah, tabel produk HARUS dibaca dari satu tempat saja — kalau tidak, stok
// yang dilihat admin berbeda dengan yang dipakai transaksi.
async function resolveMarketplaceLinks(productRefs: string[]): Promise<MarketplaceLinks> {
  if (productRefs.length === 0) return DEFAULT_MARKETPLACE_LINKS;
  const conditions = productRefs.map((ref) => `catalog_ref.eq.${ref},id.eq.${ref}`).join(",");
  const { createUserClient } = await import("@/lib/db/client.server");
  const { data: rows } = await createUserClient(null)
    .from("admin_products")
    .select("links")
    .or(conditions)
    .limit(1);
  const links = (rows?.[0] as { links?: Partial<MarketplaceLinks> } | undefined)?.links;
  return {
    shopee: links?.shopee || DEFAULT_MARKETPLACE_LINKS.shopee,
    tokopedia: links?.tokopedia || DEFAULT_MARKETPLACE_LINKS.tokopedia,
    tiktok: links?.tiktok || DEFAULT_MARKETPLACE_LINKS.tiktok,
  };
}

export async function createOrder(data: PlaceOrderData): Promise<PlaceOrderResult> {
  // Nama variabel dipertahankan supaya pemanggilan di bawahnya tidak
  // berubah; yang berganti hanya tujuannya, ke PostgreSQL lokal.
  const { createServiceClient } = await import("@/lib/db/client.server");
  const supabaseAdmin = createServiceClient();

  const subtotal = data.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  if (subtotal <= 0) return { ok: false, error: "Order total must be greater than zero." };

  const code = data.promoCode.trim().toUpperCase();
  if (code) {
    const check = validatePromo(code, subtotal);
    if ("error" in check) return { ok: false, error: check.error };
  }
  const promo = code ? (findPromo(code) ?? null) : null;
  const totals = computeTotals(subtotal, promo);

  const userId = await currentUserId();
  const orderNumber = makeOrderNumber();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: userId,
      customer_email: data.email.toLowerCase(),
      product_name: data.items[0].title,
      quantity: data.items.reduce((sum, i) => sum + i.qty, 0),
      status: "processing",
      destination_city: data.city,
      last_update: "Order placed and awaiting confirmation",
      subtotal: totals.subtotal,
      discount: totals.discount,
      shipping_fee: totals.shipping,
      total: totals.total,
      promo_code: code,
      payment_method: data.paymentMethod,
      shipping_name: data.name,
      shipping_phone: data.phone,
      shipping_address: data.address,
      shipping_postal_code: data.postalCode,
      notes: data.notes,
      notify_status_updates: data.notifyStatusUpdates,
      notify_level: data.notifyStatusUpdates ? "all" : "none",
    })
    .select("id, order_number, total")
    .single();

  if (error || !order) {
    console.error("createOrder failed", error);
    return { ok: false, error: "We could not save your order. Please try again." };
  }

  const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
    data.items.map((i) => ({
      order_id: order.id,
      product_ref: i.productRef,
      title: i.title,
      image: i.image,
      unit_price: i.unitPrice,
      quantity: i.qty,
      line_total: i.unitPrice * i.qty,
    })),
  );
  if (itemsError) {
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    return { ok: false, error: "We could not save your order items. Please try again." };
  }

  // Best-effort stock decrement for catalog-linked products.
  //
  // Memakai klien yang sama dengan penulisan pesanan di atas: setelah cutover
  // keduanya menghadap PostgreSQL lokal, jadi klien katalog terpisah tidak lagi
  // diperlukan. Klien service memang yang tepat di sini — penulisan stok adalah
  // aksi sistem di tengah checkout, dan pembelinya bukan admin.
  for (const item of data.items) {
    const { data: rows } = await supabaseAdmin
      .from("admin_products")
      .select("id, stock")
      .or(`catalog_ref.eq.${item.productRef},id.eq.${item.productRef}`)
      .limit(1);
    const row = rows?.[0] as { id: string; stock: number } | undefined;
    if (row && typeof row.stock === "number") {
      await supabaseAdmin
        .from("admin_products")
        .update({ stock: Math.max(0, row.stock - item.qty) })
        .eq("id", row.id);
    }
  }

  if (userId) await supabaseAdmin.from("cart_items").delete().eq("user_id", userId);

  const marketplaceLinks = await resolveMarketplaceLinks(data.items.map((i) => i.productRef));

  const { sendOrderConfirmationEmail } = await import("./order-emails.server");
  await sendOrderConfirmationEmail({
    orderId: order.id,
    orderNumber: order.order_number,
    email: data.email.toLowerCase(),
    customerName: data.name,
    items: data.items.map((i) => ({
      title: i.title,
      quantity: i.qty,
      lineTotal: i.unitPrice * i.qty,
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    shippingFee: totals.shipping,
    total: totals.total,
    paymentMethod: data.paymentMethod,
    shippingAddress: [data.address, data.city, data.postalCode].filter(Boolean).join(", "),
    marketplaceLinks,
  });

  // The customer is already notified of the initial status by the confirmation email.
  await supabaseAdmin.from("orders").update({ notified_status: "processing" }).eq("id", order.id);

  return { ok: true, orderNumber: order.order_number, total: totals.total };
}

const ORDER_COLUMNS =
  "id, order_number, status, total, subtotal, discount, shipping_fee, promo_code, payment_method, quantity, created_at, product_name, courier, tracking_number, eta_date, destination_city, last_update, shipping_name, shipping_phone, shipping_address, shipping_postal_code, customer_email, user_id";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSummary(row: any): OrderSummary {
  return {
    orderNumber: row.order_number,
    status: row.status,
    total: row.total ?? 0,
    quantity: row.quantity ?? 0,
    createdAt: row.created_at,
    productName: row.product_name,
    courier: row.courier,
    trackingNumber: row.tracking_number,
    etaDate: row.eta_date,
  };
}

function mapDetail(row: any, items: any[]): OrderDetail {
  return {
    ...mapSummary(row),
    subtotal: row.subtotal ?? 0,
    discount: row.discount ?? 0,
    shippingFee: row.shipping_fee ?? 0,
    promoCode: row.promo_code ?? "",
    paymentMethod: row.payment_method ?? "cod",
    destinationCity: row.destination_city,
    lastUpdate: row.last_update,
    shipping: {
      name: row.shipping_name ?? "",
      phone: row.shipping_phone ?? "",
      address: row.shipping_address ?? "",
      postalCode: row.shipping_postal_code ?? "",
    },
    items: (items ?? []).map((i) => ({
      productRef: i.product_ref,
      title: i.title,
      image: i.image,
      unitPrice: i.unit_price ?? 0,
      quantity: i.quantity ?? 1,
      lineTotal: i.line_total ?? 0,
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchMyOrders(): Promise<OrderSummary[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  // Nama variabel dipertahankan supaya pemanggilan di bawahnya tidak
  // berubah; yang berganti hanya tujuannya, ke PostgreSQL lokal.
  const { createServiceClient } = await import("@/lib/db/client.server");
  const supabaseAdmin = createServiceClient();
  const { data } = await supabaseAdmin
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map(mapSummary);
}

export async function fetchOrderDetail(input: {
  orderNumber: string;
  email?: string;
}): Promise<OrderDetailResult> {
  // Nama variabel dipertahankan supaya pemanggilan di bawahnya tidak
  // berubah; yang berganti hanya tujuannya, ke PostgreSQL lokal.
  const { createServiceClient } = await import("@/lib/db/client.server");
  const supabaseAdmin = createServiceClient();
  const userId = await currentUserId();

  const { data: row } = await supabaseAdmin
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("order_number", input.orderNumber.toUpperCase())
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };

  const ownedBySession = Boolean(userId) && (row as { user_id: string | null }).user_id === userId;
  const emailMatches =
    Boolean(input.email) &&
    String((row as { customer_email?: string }).customer_email ?? "").toLowerCase() ===
      input.email!.toLowerCase();
  if (!ownedBySession && !emailMatches) return { ok: false, reason: "forbidden" };

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_ref, title, image, unit_price, quantity, line_total")
    .eq("order_id", (row as { id: string }).id);

  return { ok: true, order: mapDetail(row, items ?? []) };
}

/** In-memory cooldown so the resend button can't be hammered (per worker instance). */
const resendCooldown = new Map<string, number>();
const RESEND_COOLDOWN_MS = 60_000;

export async function resendOrderConfirmation(input: {
  orderNumber: string;
  email?: string;
}): Promise<ResendConfirmationResult> {
  // Nama variabel dipertahankan supaya pemanggilan di bawahnya tidak
  // berubah; yang berganti hanya tujuannya, ke PostgreSQL lokal.
  const { createServiceClient } = await import("@/lib/db/client.server");
  const supabaseAdmin = createServiceClient();
  const userId = await currentUserId();
  const orderNumber = input.orderNumber.toUpperCase();

  const { data: row } = await supabaseAdmin
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };

  const order = row as Record<string, any>;
  const ownedBySession = Boolean(userId) && order.user_id === userId;
  const emailMatches =
    Boolean(input.email) &&
    String(order.customer_email ?? "").toLowerCase() === input.email!.toLowerCase();
  if (!ownedBySession && !emailMatches) return { ok: false, reason: "forbidden" };

  const recipient = String(order.customer_email ?? "").toLowerCase();
  if (!recipient) return { ok: false, reason: "no_email" };

  const now = Date.now();
  const last = resendCooldown.get(orderNumber) ?? 0;
  if (now - last < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - (now - last)) / 1000),
    };
  }

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_ref, title, quantity, line_total")
    .eq("order_id", order.id);

  const marketplaceLinks = await resolveMarketplaceLinks(
    (items ?? []).map((i: any) => i.product_ref).filter(Boolean),
  );

  const { sendOrderConfirmationEmail, maskEmail } = await import("./order-emails.server");
  const result = await sendOrderConfirmationEmail({
    orderId: order.id,
    orderNumber,
    email: recipient,
    customerName: order.shipping_name ?? "",
    items: (items ?? []).map((i: any) => ({
      title: i.title,
      quantity: i.quantity ?? 1,
      lineTotal: i.line_total ?? 0,
    })),
    subtotal: order.subtotal ?? 0,
    discount: order.discount ?? 0,
    shippingFee: order.shipping_fee ?? 0,
    total: order.total ?? 0,
    paymentMethod: order.payment_method ?? "cod",
    shippingAddress: [order.shipping_address, order.destination_city, order.shipping_postal_code]
      .filter(Boolean)
      .join(", "),
    marketplaceLinks,
    // Unique per request window so the resend is not deduped against the original email.
    idempotencyKey: `order-confirmation-resend-${order.id}-${Math.floor(now / RESEND_COOLDOWN_MS)}`,
  });

  if (!result.sent) {
    if (result.reason === "recipient_suppressed") return { ok: false, reason: "suppressed" };
    return { ok: false, reason: "send_failed" };
  }

  resendCooldown.set(orderNumber, now);
  return { ok: true, email: maskEmail(recipient) };
}

/**
 * Delivery history for an order's confirmation/status emails. Sejak pindah ke
 * Resend belum ada sumber log-nya, jadi selalu mengembalikan unavailable.
 */
export async function fetchOrderEmailHistory(input: {
  orderNumber: string;
  email?: string;
}): Promise<OrderEmailHistoryResult> {
  // Nama variabel dipertahankan supaya pemanggilan di bawahnya tidak
  // berubah; yang berganti hanya tujuannya, ke PostgreSQL lokal.
  const { createServiceClient } = await import("@/lib/db/client.server");
  const supabaseAdmin = createServiceClient();
  const userId = await currentUserId();
  const orderNumber = input.orderNumber.toUpperCase();

  const { data: row } = await supabaseAdmin
    .from("orders")
    .select("id, customer_email, user_id, created_at")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };

  const order = row as Record<string, any>;
  const ownedBySession = Boolean(userId) && order.user_id === userId;
  const emailMatches =
    Boolean(input.email) &&
    String(order.customer_email ?? "").toLowerCase() === input.email!.toLowerCase();
  if (!ownedBySession && !emailMatches) return { ok: false, reason: "forbidden" };

  const recipient = String(order.customer_email ?? "").toLowerCase();
  if (!recipient) return { ok: false, reason: "no_email" };

  const { maskEmail } = await import("./order-emails.server");
  const lastResend = resendCooldown.get(orderNumber);
  const base = {
    ok: true as const,
    email: maskEmail(recipient),
    lastResendAt: lastResend ? new Date(lastResend).toISOString() : null,
  };

  // Riwayat pengiriman dulu dibaca dari log terkelola Lovable. Setelah pindah
  // ke Resend sumber itu hilang: Resend tidak menyediakan endpoint "cari email
  // berdasarkan penerima" — status pengiriman hanya didorong lewat webhook
  // (email.sent, email.delivered, email.bounced, ...).
  //
  // Untuk menghidupkan lagi: buat tabel email_events, daftarkan endpoint
  // webhook Resend yang menulis ke tabel itu, lalu baca dari sini.
  // Sampai itu ada, ditandai unavailable — UI sudah menangani kasus ini dan
  // tetap menampilkan alamat serta cooldown kirim ulang.
  return { ...base, events: [], historyStartsAt: null, unavailable: true };
}
