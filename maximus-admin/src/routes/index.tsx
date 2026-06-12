import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maximus Admin" },
      { name: "description", content: "Painel operacional da Maximus Hamburgueria." },
      { property: "og:title", content: "Maximus Admin" },
      { property: "og:description", content: "Painel operacional da Maximus Hamburgueria." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="admin-root flex min-h-screen items-center justify-center bg-background p-4 font-sora">
      <section className="max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-2xl font-black">Maximus Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Acesse o painel operacional para escolher uma unidade.
        </p>
        <Link
          to="/admin"
          className="mt-5 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground"
        >
          Entrar no painel
        </Link>
      </section>
    </main>
  );
}
