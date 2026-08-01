import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PlaceholderSection } from "@/components/admin/PlaceholderSection";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — PasarPilih Admin" },
      { name: "description", content: "Review customer profiles, order history and lifetime value on PasarPilih." },
      { property: "og:title", content: "Customers — PasarPilih Admin" },
      { property: "og:description", content: "Customer profiles and purchase history for PasarPilih admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PlaceholderSection
      title="Customers"
      description="Understand who is buying and how often."
      icon={Users}
      bullets={[
        "Searchable customer directory with lifetime value",
        "Per-customer order and wishlist history",
        "Segments for repeat buyers and lapsed shoppers",
      ]}
    />
  ),
});
