import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import {
  brand,
  button,
  buttonOutline,
  card,
  container,
  footer,
  formatIdr,
  header,
  heading,
  label,
  main,
  muted,
  paragraph,
  value,
} from "./theme";

interface LineItem {
  title?: string;
  quantity?: number;
  lineTotal?: number;
}

interface MarketplaceLinks {
  shopee?: string;
  tokopedia?: string;
  tiktok?: string;
}

interface Props {
  customerName?: string;
  orderNumber?: string;
  maskedEmail?: string;
  items?: LineItem[];
  subtotal?: number;
  discount?: number;
  shippingFee?: number;
  total?: number;
  paymentMethod?: string;
  shippingAddress?: string;
  trackingUrl?: string;
  marketplaceLinks?: MarketplaceLinks;
}

const Email = ({
  customerName,
  orderNumber = "",
  maskedEmail,
  items = [],
  subtotal = 0,
  discount = 0,
  shippingFee = 0,
  total = 0,
  paymentMethod = "cod",
  shippingAddress = "",
  trackingUrl,
  marketplaceLinks,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Order ${orderNumber} confirmed — we're getting it ready`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={header}>PasarPilih</Text>
        <Heading style={heading}>Thanks{customerName ? `, ${customerName}` : ""}! 🎉</Heading>
        <Text style={paragraph}>
          We received your order <strong>{orderNumber}</strong> and it is now being prepared. We
          will email you as soon as the status changes.
        </Text>

        {maskedEmail ? (
          <Text style={muted}>A copy of this receipt was sent to {maskedEmail}</Text>
        ) : null}

        <Section style={card}>
          <Text style={{ ...label, fontSize: "14px", fontWeight: 700, marginBottom: "10px" }}>
            Order summary
          </Text>
          {items.map((item, index) => (
            <Row key={index} style={{ marginBottom: "8px" }}>
              <Text style={{ ...value, margin: 0, width: "70%", display: "inline-block" }}>
                {item.title ?? "Item"} × {item.quantity ?? 1}
              </Text>
              <Text
                style={{
                  ...value,
                  margin: 0,
                  width: "30%",
                  display: "inline-block",
                  textAlign: "right",
                  color: brand.muted,
                  fontWeight: 400,
                }}
              >
                {formatIdr(item.lineTotal ?? 0)}
              </Text>
            </Row>
          ))}
          <Hr style={{ borderColor: brand.border, margin: "12px 0" }} />
          <Row>
            <Text style={{ ...label, width: "50%", display: "inline-block" }}>Subtotal</Text>
            <Text
              style={{ ...value, width: "50%", display: "inline-block", textAlign: "right", margin: 0 }}
            >
              {formatIdr(subtotal)}
            </Text>
          </Row>
          {discount > 0 ? (
            <Row>
              <Text style={{ ...label, width: "50%", display: "inline-block" }}>Discount</Text>
              <Text
                style={{
                  ...value,
                  width: "50%",
                  display: "inline-block",
                  textAlign: "right",
                  margin: 0,
                }}
              >
                -{formatIdr(discount)}
              </Text>
            </Row>
          ) : null}
          <Row>
            <Text style={{ ...label, width: "50%", display: "inline-block" }}>Shipping</Text>
            <Text
              style={{ ...value, width: "50%", display: "inline-block", textAlign: "right", margin: 0 }}
            >
              {shippingFee > 0 ? formatIdr(shippingFee) : "Free"}
            </Text>
          </Row>
          <Hr style={{ borderColor: brand.border, margin: "12px 0" }} />
          <Row>
            <Text
              style={{
                ...label,
                width: "50%",
                display: "inline-block",
                fontWeight: 700,
                color: brand.text,
              }}
            >
              Total
            </Text>
            <Text
              style={{
                ...value,
                width: "50%",
                display: "inline-block",
                textAlign: "right",
                margin: 0,
                fontSize: "18px",
                color: brand.primaryDark,
              }}
            >
              {formatIdr(total)}
            </Text>
          </Row>
          <Row style={{ marginTop: "12px" }}>
            <Text style={{ ...label, width: "50%", display: "inline-block" }}>Payment method</Text>
            <Text
              style={{
                ...value,
                width: "50%",
                display: "inline-block",
                textAlign: "right",
                margin: 0,
                textTransform: "capitalize",
              }}
            >
              {paymentMethod.replace("_", " ")}
            </Text>
          </Row>
          {shippingAddress ? (
            <Row style={{ marginTop: "12px" }}>
              <Text style={{ ...label, width: "50%", display: "inline-block" }}>Shipping to</Text>
              <Text
                style={{
                  ...value,
                  width: "50%",
                  display: "inline-block",
                  textAlign: "right",
                  margin: 0,
                }}
              >
                {shippingAddress}
              </Text>
            </Row>
          ) : null}
        </Section>

        {trackingUrl ? (
          <Section style={{ margin: "8px 0 4px" }}>
            <Button href={trackingUrl} style={button}>
              Track this order
            </Button>
          </Section>
        ) : null}

        {marketplaceLinks && (marketplaceLinks.shopee || marketplaceLinks.tokopedia || marketplaceLinks.tiktok) ? (
          <Section style={card}>
            <Text style={{ ...label, fontSize: "14px", fontWeight: 700, marginBottom: "10px" }}>
              Continue shopping on your favorite marketplace
            </Text>
            <Text style={muted}>
              PasarPilih compares prices across top marketplaces. You can also browse or buy
              directly from the stores below.
            </Text>
            <Section style={{ textAlign: "center", marginTop: "12px" }}>
              {marketplaceLinks.shopee ? (
                <Button href={marketplaceLinks.shopee} style={marketplaceButton("#ee4d2d")}>
                  Shopee
                </Button>
              ) : null}
              {marketplaceLinks.tokopedia ? (
                <Button href={marketplaceLinks.tokopedia} style={marketplaceButton("#03ac0e")}>
                  Tokopedia
                </Button>
              ) : null}
              {marketplaceLinks.tiktok ? (
                <Button href={marketplaceLinks.tiktok} style={marketplaceButton("#000000")}>
                  TikTok Shop
                </Button>
              ) : null}
            </Section>
          </Section>
        ) : null}

        <Text style={footer}>
          Questions about your order? Just reply to this email and our team will help you out.
        </Text>
      </Container>
    </Body>
  </Html>
);

function marketplaceButton(color: string) {
  return {
    ...buttonOutline,
    borderColor: color,
    color,
    margin: "0 4px 8px",
  };
}

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `Order ${String(data.orderNumber ?? "")} confirmed — PasarPilih`,
  displayName: "Order confirmation",
  previewData: {
    customerName: "Rani",
    orderNumber: "PP-20260730-A1B2C",
    maskedEmail: "ra••••@gmail.com",
    items: [
      { title: "Urban Runner Sneakers", quantity: 1, lineTotal: 459000 },
      { title: "Wireless ANC Headphones", quantity: 2, lineTotal: 1198000 },
    ],
    subtotal: 1657000,
    discount: 165700,
    shippingFee: 0,
    total: 1491300,
    paymentMethod: "cod",
    shippingAddress: "Jl. Melati No. 12, Bandung, 40123",
    trackingUrl: "https://example.com/track?order=PP-20260730-A1B2C",
    marketplaceLinks: {
      shopee: "https://shopee.co.id",
      tokopedia: "https://www.tokopedia.com",
      tiktok: "https://www.tiktok.com/shop",
    },
  },
} satisfies TemplateEntry;
