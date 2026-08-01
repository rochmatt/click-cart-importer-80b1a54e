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
  status?: string;
  headline?: string;
  message?: string;
  refundAmount?: number;
  refundMethod?: string;
  refundEta?: string;
  reason?: string;
  orderUrl?: string;
  supportUrl?: string;
}

const Email = ({
  customerName,
  orderNumber = "",
  status = "refund_processing",
  headline = "Refund update for your order",
  message = "There is a new update about your refund.",
  refundAmount,
  refundMethod,
  refundEta,
  reason,
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
          <Text style={label}>Refund status</Text>
          <Text style={{ ...value, color: brand.primaryDark, textTransform: "capitalize" }}>
            {status.replace(/_/g, " ")}
          </Text>
          {typeof refundAmount === "number" ? (
            <>
              <Text style={label}>Refund amount</Text>
              <Text style={value}>{formatIdr(refundAmount)}</Text>
            </>
          ) : null}
          {refundMethod ? (
            <>
              <Text style={label}>Refunded to</Text>
              <Text style={{ ...value, textTransform: "capitalize" }}>
                {refundMethod.replace(/_/g, " ")}
              </Text>
            </>
          ) : null}
          {refundEta ? (
            <>
              <Text style={label}>Expected in your account</Text>
              <Text style={value}>{refundEta}</Text>
            </>
          ) : null}
          {reason ? (
            <>
              <Text style={label}>Note</Text>
              <Text style={{ ...value, marginBottom: 0 }}>{reason}</Text>
            </>
          ) : null}
        </Section>

        {orderUrl ? (
          <Section style={{ margin: "8px 0 4px" }}>
            <Button href={orderUrl} style={button}>
              View order details
            </Button>
          </Section>
        ) : null}

        {supportUrl ? (
          <Text style={{ ...paragraph, margin: "12px 0 0" }}>
            Questions about this refund?{" "}
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
    `${String(data.headline ?? "Refund update")} — ${String(data.orderNumber ?? "")}`,
  displayName: "Order refund update",
  previewData: {
    customerName: "Rani",
    orderNumber: "PP-20260730-A1B2C",
    status: "refunded",
    headline: "Your refund has been sent 💸",
    message: "We've released your refund back to your original payment method.",
    refundAmount: 349000,
    refundMethod: "bank transfer",
    refundEta: "3–5 business days",
    orderUrl: "https://example.com/orders/PP-20260730-A1B2C",
    supportUrl: "https://example.com/track?order=PP-20260730-A1B2C",
  },
} satisfies TemplateEntry;
