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

const placeOrderSchema = z.object({
  items: z.array(itemSchema).min(1, "Your cart is empty").max(50),
  email: z.string().trim().email("Enter a valid email address").max(255),
  name: z.string().trim().min(2, "Enter the recipient name").max(120),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(30),
  address: z.string().trim().min(6, "Enter the full street address").max(500),
  city: z.string().trim().min(2, "Enter the destination city").max(120),
  postalCode: z.string().trim().max(12).default(""),
  notes: z.string().trim().max(500).default(""),
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
