import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getCurrentCustomer } from "@/lib/customer";
import { formatPrice } from "@/lib/format";
import { getDefaultSelections } from "@/lib/cart-customization";
import { loadPublicMenu } from "@/lib/supabase-data";
import { useCart } from "@/lib/store";
import type { CustomerOrderHistory, CustomerProfile } from "@/lib/types";

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
  const [repeatingOrderId, setRepeatingOrderId] = useState<string | null>(null);
  const { addItem, clearItems } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    getCurrentCustomer()
      .then(setCustomer)
      .catch(() => setCustomer(null));
  }, []);

  const orders = customer?.orders ?? [];

  async function repeatOrder(order: CustomerOrderHistory) {
    setRepeatingOrderId(order.id);
    try {
      const data = await loadPublicMenu(undefined, order.mode === "mesa" ? "dine_in" : "delivery");
      const productsByName = new Map(
        data.products.map((product) => [product.name.trim().toLowerCase(), product]),
      );
      let added = 0;
      clearItems();
      for (const item of order.items) {
        const product = productsByName.get(item.name.trim().toLowerCase());
        if (!product) continue;
        const selections = getDefaultSelections(product);
        for (let index = 0; index < item.quantity; index += 1) {
          addItem(product, selections);
          added += 1;
        }
      }
      if (!added) {
        toast.error("Não foi possível repetir os itens disponíveis desse pedido.");
        return;
      }
      if (added < order.items.reduce((sum, item) => sum + item.quantity, 0)) {
        toast.info("Alguns itens antigos não estão disponíveis e não foram adicionados.");
      }
      toast.success("Itens adicionados à sacola.");
      navigate({ to: "/checkout" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível repetir o pedido.");
    } finally {
      setRepeatingOrderId(null);
    }
  }

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

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="font-black text-primary">{formatPrice(order.total)}</span>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild size="sm" className="bg-gradient-primary font-bold">
                      <Link to="/acompanhar/$id" params={{ id: order.id }}>
                        <ClipboardList className="mr-1.5 h-4 w-4" />
                        Acompanhar pedido
                      </Link>
                    </Button>
                    <button
                      onClick={() => repeatOrder(order)}
                      disabled={repeatingOrderId === order.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-[11px] font-bold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {repeatingOrderId === order.id ? "Adicionando..." : "Pedir novamente"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
