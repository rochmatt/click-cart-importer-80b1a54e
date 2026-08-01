import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { PlaceholderSection } from "@/components/admin/PlaceholderSection";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — PasarPilih Admin" },
      { name: "description", content: "Track order status, couriers and fulfilment across the PasarPilih store." },
      { property: "og:title", content: "Orders — PasarPilih Admin" },
      { property: "og:description", content: "Order tracking and fulfilment for PasarPilih store admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PlaceholderSection
      title="Orders"
      description="Follow every order from payment to delivery."
      icon={ShoppingCart}
      bullets={[
        "Status pipeline with courier and tracking numbers",
        "Refund and return request handling",
        "Exportable daily settlement reports",
      ]}
    />
  ),
});
