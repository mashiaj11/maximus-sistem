import { Navigate, createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminProvider } from "@/admin/store";
import { AdminLayout } from "@/admin/components/AdminLayout";
import { useAuth } from "@/auth/AuthProvider";

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
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <main className="admin-root admin-root--dark flex min-h-screen items-center justify-center p-4 font-sora">
        <section className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-xl">
          <p className="text-lg font-black">Validando sessão</p>
          <p className="mt-2 text-sm text-muted-foreground">Carregando acesso administrativo.</p>
        </section>
      </main>
    );
  }

  if (auth.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (auth.status === "password_recovery") {
    return <Navigate to="/redefinir-senha" replace />;
  }

  if (auth.status === "blocked") {
    return (
      <main className="admin-root admin-root--dark flex min-h-screen items-center justify-center p-4 font-sora">
        <section className="w-full max-w-md rounded-xl border border-destructive/40 bg-card p-6 text-center shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Acesso bloqueado
          </p>
          <h1 className="mt-3 text-2xl font-black">Não foi possível liberar o painel</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {auth.error ?? "Seu usuário não possui autorização administrativa ativa."}
          </p>
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Sair
          </button>
        </section>
      </main>
    );
  }

  return (
    <AdminProvider>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </AdminProvider>
  );
}
