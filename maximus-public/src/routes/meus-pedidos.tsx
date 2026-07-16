import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  findCustomerByPhone,
  getCurrentCustomer,
  getSavedCustomerProfile,
  normalizePhone,
  saveSavedCustomerProfile,
} from "@/lib/customer";
import { formatPrice } from "@/lib/format";
import { getSelectionErrors } from "@/lib/cart-customization";
import { loadCustomerReorderPayload, loadPublicMenu } from "@/lib/supabase-data";
import { useCart } from "@/lib/store";
import type { CustomerOrderHistory, CustomerProfile } from "@/lib/types";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos â€” Maximus" },
      { name: "description", content: "HistÃ³rico de pedidos da Maximus." },
    ],
  }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const savedProfile = getSavedCustomerProfile();
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [name, setName] = useState(savedProfile?.name ?? "");
  const [phone, setPhone] = useState(savedProfile?.phone ?? "");
  const [searched, setSearched] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [repeatingOrderId, setRepeatingOrderId] = useState<string | null>(null);
  const { addItem, clearItems } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    getCurrentCustomer()
      .then((profile) => {
        setCustomer(profile);
        if (profile) {
          setName(profile.name);
          setPhone(profile.phone);
          setSearched(true);
        }
      })
      .catch(() => setCustomer(null));
  }, []);

  const orders = customer?.orders ?? [];

  async function searchOrders() {
    const cleanPhone = normalizePhone(phone);
    if (name.trim().length < 2) return toast.error("Informe seu nome.");
    if (cleanPhone.length < 10 || cleanPhone.length > 13)
      return toast.error("Informe um telefone valido.");
    setLoadingOrders(true);
    try {
      const profile = await findCustomerByPhone(cleanPhone, name);
      setCustomer(profile);
      setSearched(true);
      saveSavedCustomerProfile({
        name: name.trim(),
        phone: cleanPhone,
        customer_id: profile?.id,
      });
    } catch (error) {
      setCustomer(null);
      setSearched(true);
      toast.error(error instanceof Error ? error.message : "Nao foi possivel buscar seus pedidos.");
    } finally {
      setLoadingOrders(false);
    }
  }

  async function repeatOrder(order: CustomerOrderHistory) {
    setRepeatingOrderId(order.id);
    try {
      const reorder = await loadCustomerReorderPayload(order.id);
      const mode =
        reorder.order_type === "dine_in"
          ? "dine_in"
          : reorder.order_type === "takeaway"
            ? "pickup"
            : "delivery";
      const data = await loadPublicMenu(reorder.unit_id, mode);
      const productsById = new Map(data.products.map((product) => [product.id, product]));
      let added = 0;
      const unavailable: string[] = [];
      clearItems();
      const normalizeReorderText = (value?: string | null) =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

      const reorderItems = Array.isArray(reorder.items) ? reorder.items : [];

      for (const item of reorderItems) {
        const itemRecord = item as typeof item & {
          id?: string;
          name?: string;
          product_name?: string;
          product_id?: string;
          quantity?: number | string;
          available?: boolean;
          notes?: string | null;
          selections?: Array<{
            group_id?: string;
            choice_id?: string;
            available?: boolean;
          }>;
          customizations?: string[];
        };

        const productId = itemRecord.product_id ?? itemRecord.id;
        const product = productId ? productsById.get(productId) : undefined;
        const itemName = itemRecord.product_name ?? itemRecord.name ?? "Item";
        const itemSelections = Array.isArray(itemRecord.selections) ? itemRecord.selections : [];
        const rawCustomizations = Array.isArray(itemRecord.customizations)
          ? itemRecord.customizations
          : [];

        if (!product || itemRecord.available === false) {
          unavailable.push(itemName);
          continue;
        }

        const optionGroups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
        const selections = Object.fromEntries(
          optionGroups.map((group) => {
            const directChoices = itemSelections
              .filter(
                (selection) =>
                  selection.group_id === group.id &&
                  selection.choice_id &&
                  selection.available !== false,
              )
              .map((selection) => selection.choice_id as string);

            if (directChoices.length) {
              return [group.id, directChoices];
            }

            const groupName = normalizeReorderText(group.title);
            const choices = group.options;
            const matchedChoices = choices
              .filter((choice) =>
                rawCustomizations.some((customization) => {
                  const normalizedCustomization = normalizeReorderText(customization);
                  const choiceName = normalizeReorderText(choice.label);

                  return (
                    normalizedCustomization === choiceName ||
                    normalizedCustomization === `${groupName}: ${choiceName}` ||
                    normalizedCustomization.includes(`${groupName}: ${choiceName}`)
                  );
                }),
              )
              .map((choice) => choice.id);

            return [group.id, matchedChoices];
          }),
        );

        const hasUnavailableSelection = itemSelections.some(
          (selection) => selection.available === false,
        );

        if (hasUnavailableSelection || getSelectionErrors(product, selections).length) {
          unavailable.push(itemName);
          continue;
        }

        const quantity = Math.max(1, Number(itemRecord.quantity || 1));

        for (let index = 0; index < quantity; index += 1) {
          addItem(product, selections, itemRecord.notes || undefined);
          added += 1;
        }
      }
      if (!added) {
        toast.error("NÃ£o foi possÃ­vel repetir os itens disponÃ­veis desse pedido.");
        return;
      }
      if (unavailable.length) {
        toast.info(
          `Alguns itens ou adicionais nÃ£o estÃ£o mais disponÃ­veis: ${[...new Set(unavailable)].join(", ")}.`,
        );
      }
      toast.success("Itens adicionados Ã  sacola.");
      navigate({ to: "/checkout" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel repetir o pedido.");
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
              {customer.name} Â· {customer.phone}
            </p>
          )}
        </div>

        {!customer ? (
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orders-name">Nome</Label>
                <Input
                  id="orders-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orders-phone">Telefone</Label>
                <Input
                  id="orders-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <Button
                className="w-full bg-gradient-primary font-bold"
                disabled={loadingOrders}
                onClick={searchOrders}
              >
                {loadingOrders ? "Buscando..." : "Buscar meus pedidos"}
              </Button>
              {searched && (
                <p className="text-center text-sm text-muted-foreground">
                  Nenhum pedido encontrado para este telefone.
                </p>
              )}
            </div>
          </section>
        ) : orders.length === 0 ? (
          <section className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">Nenhum pedido encontrado para este telefone.</p>
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

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <p>
                    <span className="text-muted-foreground">Tipo:</span>{" "}
                    {orderTypeLabel(order.mode)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Pagamento:</span>{" "}
                    {paymentLabel(order.paymentMethod)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span> {order.status}
                  </p>
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
                    Entrega: {order.address.street}, {order.address.number} Â·{" "}
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

function orderTypeLabel(mode: CustomerOrderHistory["mode"]) {
  if (mode === "delivery") return "Delivery";
  if (mode === "mesa") return "Mesa";
  return "Retirada";
}

function paymentLabel(method?: string) {
  const labels: Record<string, string> = {
    pix_app: "PIX pelo app",
    pix_balcao: "PIX no balcÃ£o",
    cartao: "CartÃ£o",
    dinheiro: "Dinheiro",
    local: "Pagamento no local",
  };
  return method ? (labels[method] ?? method) : "NÃ£o informado";
}
