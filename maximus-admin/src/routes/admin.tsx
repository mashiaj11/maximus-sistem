import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminProvider } from "@/admin/store";
import { AdminLayout } from "@/admin/components/AdminLayout";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · Maximus Hamburgueria" },
      { name: "description", content: "Painel operacional interno da Maximus Hamburgueria." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRoot,
});

function AdminRoot() {
  return (
    <AdminProvider>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </AdminProvider>
  );
}
