import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import {
  brand,
  button,
  card,
  container,
  footer,
  formatIdr,
  header,
  heading,
  label,
  main,
  paragraph,
  value,
} from "./theme";

interface Props {
  customerName?: string;
  orderNumber?: string;
  headline?: string;
  message?: string;
  reason?: string;
  cancelledAt?: string;
  total?: number;
  paymentMethod?: string;
  refundExpected?: boolean;
  orderUrl?: string;
  supportUrl?: string;
}

const Email = ({
  customerName,
  orderNumber = "",
  headline = "Your order was cancelled",
  message = "This order has been cancelled and will not be shipped.",
  reason,
  cancelledAt,
  total,
  paymentMethod,
  refundExpected = false,
  orderUrl,
  supportUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${headline} — order ${orderNumber}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={header}>PasarPilih</Text>
        <Heading style={heading}>{headline}</Heading>
        <Text style={paragraph}>
          {customerName ? `Hi ${customerName}, ` : ""}
          {message}
        </Text>

        <Section style={card}>
          <Text style={label}>Order number</Text>
          <Text style={value}>{orderNumber}</Text>
          {reason ? (
            <>
              <Text style={label}>Reason</Text>
              <Text style={value}>{reason}</Text>
            </>
          ) : null}
          {cancelledAt ? (
            <>
              <Text style={label}>Cancelled on</Text>
              <Text style={value}>{cancelledAt}</Text>
            </>
          ) : null}
          {typeof total === "number" ? (
            <>
              <Text style={label}>Order total</Text>
              <Text style={value}>{formatIdr(total)}</Text>
            </>
          ) : null}
          {paymentMethod ? (
            <>
              <Text style={label}>Payment method</Text>
              <Text style={{ ...value, marginBottom: 0, textTransform: "capitalize" }}>
                {paymentMethod.replace("_", " ")}
              </Text>
            </>
          ) : null}
        </Section>

        {refundExpected ? (
          <Text style={paragraph}>
            If you already paid for this order, a refund is being arranged. We will email you again
            as soon as the refund is on its way.
          </Text>
        ) : null}

        {orderUrl ? (
          <Section style={{ margin: "8px 0 4px" }}>
            <Button href={orderUrl} style={button}>
              View order details
            </Button>
          </Section>
        ) : null}

        {supportUrl ? (
          <Text style={{ ...paragraph, margin: "12px 0 0" }}>
            Cancelled by mistake?{" "}
            <Link href={supportUrl} style={{ color: brand.primary, fontWeight: 600 }}>
              Contact our support team
            </Link>
          </Text>
        ) : null}

        <Text style={footer}>
          You are receiving this because email updates are on for this order. You can change that
          any time from the tracking page.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `${String(data.headline ?? "Order cancelled")} — ${String(data.orderNumber ?? "")}`,
  displayName: "Order cancellation",
  previewData: {
    customerName: "Rani",
    orderNumber: "PP-20260730-A1B2C",
    headline: "Your order was cancelled",
    message: "This order has been cancelled and will not be shipped.",
    reason: "Cancelled at your request",
    cancelledAt: "30 Jul 2026",
    total: 349000,
    paymentMethod: "bank transfer",
    refundExpected: true,
    orderUrl: "https://example.com/orders/PP-20260730-A1B2C",
    supportUrl: "https://example.com/track?order=PP-20260730-A1B2C",
  },
} satisfies TemplateEntry;
