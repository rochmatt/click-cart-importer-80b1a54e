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
  courier?: string;
  trackingNumber?: string;
  etaDate?: string;
  destinationCity?: string;
  trackingUrl?: string;
  orderUrl?: string;
}

const Email = ({
  customerName,
  orderNumber = "",
  status = "processing",
  headline = "Your order status changed",
  message = "There is a new update on your order.",
  courier,
  trackingNumber,
  etaDate,
  destinationCity,
  trackingUrl,
  orderUrl,
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
          <Text style={label}>Current status</Text>
          <Text style={{ ...value, color: brand.primaryDark, textTransform: "capitalize" }}>
            {status.replace("_", " ")}
          </Text>
          {courier ? (
            <>
              <Text style={label}>Courier</Text>
              <Text style={value}>{courier}</Text>
            </>
          ) : null}
          {trackingNumber ? (
            <>
              <Text style={label}>Tracking number</Text>
              <Text style={value}>{trackingNumber}</Text>
            </>
          ) : null}
          {destinationCity ? (
            <>
              <Text style={label}>Destination</Text>
              <Text style={value}>{destinationCity}</Text>
            </>
          ) : null}
          {etaDate ? (
            <>
              <Text style={label}>Estimated arrival</Text>
              <Text style={{ ...value, marginBottom: 0 }}>{etaDate}</Text>
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

        {trackingUrl ? (
          <Text style={{ ...paragraph, margin: "12px 0 0" }}>
            Prefer the live map?{" "}
            <Link href={trackingUrl} style={{ color: brand.primary, fontWeight: 600 }}>
              Track this shipment
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
    `${String(data.headline ?? "Order update")} — ${String(data.orderNumber ?? "")}`,
  displayName: "Order status update",
  previewData: {
    customerName: "Rani",
    orderNumber: "PP-20260730-A1B2C",
    status: "shipped",
    headline: "Your order is on the way 🚚",
    message: "Your parcel has left our warehouse and is now with the courier.",
    courier: "JNE",
    trackingNumber: "JNE0099887766",
    etaDate: "2 Aug 2026",
    destinationCity: "Bandung",
    trackingUrl: "https://example.com/track?order=PP-20260730-A1B2C",
    orderUrl: "https://example.com/orders/PP-20260730-A1B2C",
  },
} satisfies TemplateEntry;
