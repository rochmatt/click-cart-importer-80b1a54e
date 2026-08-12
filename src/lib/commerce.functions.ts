import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  OrderDetailResult,
  OrderEmailHistoryResult,
  OrderSummary,
  PlaceOrderResult,
  ResendConfirmationResult,
} from "./commerce-types";

const itemSchema = z.object({
  productRef: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(300),
  image: z.string().trim().max(2000).default(""),
  unitPrice: z.number().int().min(0).max(1_000_000_000),
  qty: z.number().int().min(1).max(99),
});

// Field data pembeli & pengiriman. DIEKSPOR agar checkout.tsx memvalidasi dengan
// skema yang SAMA (buyerFieldsSchema.safeParse) — validasi klien & server tak
// pernah berbeda, sehingga isian yang lolos di klien tak ditolak diam-diam oleh
// server (yang lemparannya jadi toast "coba lagi" yang membingungkan pembeli).
export const buyerFieldsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255, "Email is too long"),
  name: z.string().trim().min(2, "Enter the recipient name").max(120, "Name is too long"),
  // Nomor harus bisa dihubungi kurir: 8–15 digit (abaikan spasi/+/tanda hubung),
  // maksimal 30 karakter mentah. Cegah isian asal seperti "123456".
  phone: z
    .string()
    .trim()
    .max(30, "Phone number is too long")
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15;
    }, "Enter a valid phone number (8–15 digits)"),
  address: z
    .string()
    .trim()
    .min(6, "Enter the full street address")
    .max(500, "Address is too long"),
  city: z.string().trim().min(2, "Enter the destination city").max(120, "City is too long"),
  postalCode: z.string().trim().max(12, "Postal code is too long").default(""),
  notes: z.string().trim().max(500, "Notes are too long").default(""),
});

const placeOrderSchema = z.object({
  items: z.array(itemSchema).min(1, "Your cart is empty").max(50),
  ...buyerFieldsSchema.shape,
  promoCode: z.string().trim().max(40).default(""),
  paymentMethod: z.enum(["cod", "bank_transfer", "ewallet"]).default("cod"),
  notifyStatusUpdates: z.boolean().default(true),
});

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

const detailSchema = z.object({
  orderNumber: z.string().trim().min(3).max(40),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => placeOrderSchema.parse(input))
  .handler(async ({ data }): Promise<PlaceOrderResult> => {
    const { createOrder } = await import("./commerce.server");
    return createOrder(data);
  });

export const listMyOrders = createServerFn({ method: "POST" }).handler(
  async (): Promise<OrderSummary[]> => {
    const { fetchMyOrders } = await import("./commerce.server");
    return fetchMyOrders();
  },
);

export const getOrderDetail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => detailSchema.parse(input))
  .handler(async ({ data }): Promise<OrderDetailResult> => {
    const { fetchOrderDetail } = await import("./commerce.server");
    return fetchOrderDetail(data);
  });

export const resendOrderConfirmationEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => detailSchema.parse(input))
  .handler(async ({ data }): Promise<ResendConfirmationResult> => {
    const { resendOrderConfirmation } = await import("./commerce.server");
    return resendOrderConfirmation(data);
  });

export const getOrderEmailHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => detailSchema.parse(input))
  .handler(async ({ data }): Promise<OrderEmailHistoryResult> => {
    const { fetchOrderEmailHistory } = await import("./commerce.server");
    return fetchOrderEmailHistory(data);
  });
