import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getCurrentCustomer } from "@/lib/customer";
import { formatPrice } from "@/lib/format";
import type { CustomerProfile } from "@/lib/types";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Maximus" },
      { name: "description", content: "Histórico de pedidos da Maximus." },
    ],
  }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    getCurrentCustomer()
      .then(setCustomer)
      .catch(() => setCustomer(null));
  }, []);

  const orders = customer?.orders ?? [];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Maximus</p>
          <h1 className="mt-2 text-3xl font-black">Meus pedidos</h1>
          {customer && (
            <p className="mt-1 text-sm text-muted-foreground">
              {customer.name} · {customer.phone}
            </p>
          )}
        </div>

        {!customer ? (
          <section className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">Finalize um pedido para salvar seu cadastro.</p>
            <Button asChild className="mt-4 bg-gradient-primary font-bold">
              <Link to="/menu">Ver cardápio</Link>
            </Button>
          </section>
        ) : orders.length === 0 ? (
          <section className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">Você ainda não tem pedidos salvos.</p>
            <Button asChild className="mt-4 bg-gradient-primary font-bold">
              <Link to="/menu">Fazer pedido</Link>
            </Button>
          </section>
        ) : (
          <section className="grid gap-4">
            {orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black">{order.number}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(order.date).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {order.status}
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Itens
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${index}`} className="flex justify-between gap-3">
                        <span>
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-bold">{formatPrice(item.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {order.address && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Entrega: {order.address.street}, {order.address.number} ·{" "}
                    {order.address.neighborhood}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="font-black text-primary">{formatPrice(order.total)}</span>
                  <button
                    disabled
                    className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Pedir novamente
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
