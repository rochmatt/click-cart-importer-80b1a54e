import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});
