import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PlaceholderSection } from "@/components/admin/PlaceholderSection";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PasarPilih Admin" },
      { name: "description", content: "Store profile, staff access and marketplace defaults for PasarPilih." },
      { property: "og:title", content: "Settings — PasarPilih Admin" },
      { property: "og:description", content: "Configure store details and marketplace defaults for PasarPilih." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PlaceholderSection
      title="Settings"
      description="Store profile, staff access and defaults."
      icon={Settings}
      bullets={[
        "Store identity, logo and contact details",
        "Staff accounts with role-based permissions",
        "Default marketplace link templates and UTM tags",
      ]}
    />
  ),
});
