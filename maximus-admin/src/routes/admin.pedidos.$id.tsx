import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MapPin, Utensils, Check, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import { StatusBadge, TypeBadge, PaymentBadge } from "@/admin/components/Badges";
import { useAdmin, formatBRL, formatTime } from "@/admin/store";
import { STATUS_FLOW, STATUS_LABELS } from "@/admin/data/statuses";
import { buildKitchenReceiptHtml, printRenderedHtml } from "@/admin/printing";
import type { AdminUnit, Order } from "@/admin/data/types";

export const Route = createFileRoute("/admin/pedidos/$id")({
  component: PedidoDetalhePage,
  notFoundComponent: () => <p className="text-muted-foreground">Pedido não encontrado.</p>,
});

const PAYMENT_LABELS: Record<string, string> = {
  pix_app: "Pix pelo app",
  pix_balcao: "Pix no balcão",
  local: "Pagamento no local",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

const KITCHEN_PRINT_LABELS = {
  pending: "Comanda pendente",
  printed: "Comanda impressa",
  error: "Falha na comanda",
  disabled: "Impressão desativada",
} as const;

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(originLat: number, originLng: number, targetLat: number, targetLng: number) {
  const dLat = toRadians(targetLat - originLat);
  const dLng = toRadians(targetLng - originLng);
  const lat1 = toRadians(originLat);
  const lat2 = toRadians(targetLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function printManualTicket(order: Order, unit?: AdminUnit | null) {
  if (typeof window === "undefined") return;
  const settings = await window.maximusDesktop?.getPrintSettings();
  const printer =
    settings?.printers.find(
      (item) => item.unitId === order.unitId && item.destination === "kitchen" && item.enabled,
    ) ?? undefined;
  const html = buildKitchenReceiptHtml(order, unit, order.items, "kitchen", printer?.paperWidth);
  const result = await printRenderedHtml(html, printer, {
    orderId: order.id,
    orderNumber: order.number,
    destination: "kitchen",
    unitId: order.unitId,
    manual: true,
  });
  if (!result.ok) throw new Error(result.error ?? "Não foi possível imprimir a comanda.");
}

function PedidoDetalhePage() {
  const { id } = useParams({ from: "/admin/pedidos/$id" });
  const { orders, units, updateStatus, setPayment } = useAdmin();
  const [reprinting, setReprinting] = useState(false);
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div>
        <Link to="/admin/pedidos" className="text-sm text-primary">
          ← Voltar aos pedidos
        </Link>
        <p className="mt-4 text-muted-foreground">Pedido não encontrado.</p>
      </div>
    );
  }

  const flow = STATUS_FLOW[order.type];
  const isPixApp = order.paymentMethod === "pix_app";
  const unit = units.find((item) => item.id === order.unitId);
  const deliveryLat = order.deliveryLat ?? order.delivery_lat;
  const deliveryLng = order.deliveryLng ?? order.delivery_lng;
  const locationSource = order.deliveryLocationSource ?? order.delivery_location_source;
  const driverLat = order.driverLat ?? order.driver_lat;
  const driverLng = order.driverLng ?? order.driver_lng;
  const hasDeliveryLocation = deliveryLat != null && deliveryLng != null;
  const hasDriverLocation = driverLat != null && driverLng != null;
  const remainingDistanceKm =
    hasDeliveryLocation && hasDriverLocation
      ? getDistanceKm(driverLat, driverLng, deliveryLat, deliveryLng)
      : null;

  return (
    <div>
      <Link
        to="/admin/pedidos"
        className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <PageHeader
        title={`Pedido #${order.number}`}
        subtitle={`${formatTime(order.createdAt)} · ${order.customerName}`}
        action={
          <div className="flex items-center gap-2">
            <TypeBadge type={order.type} />
            <StatusBadge status={order.status} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Itens */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-base font-extrabold">Itens</h2>
            <ul className="divide-y divide-border">
              {order.items.map((it) => (
                <li key={it.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {it.quantity}x {it.name}
                      </p>
                      {it.customizations.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {it.customizations.map((c, i) => (
                            <li key={i} className="text-xs text-primary">
                              • {c}
                            </li>
                          ))}
                        </ul>
                      )}
                      {it.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">Obs: {it.notes}</p>
                      )}
                    </div>
                    <span className="font-medium whitespace-nowrap">
                      {formatBRL(it.unitPrice * it.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-bold">
              <span>Total</span>
              <span>{formatBRL(order.total)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">Observações</h3>
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </div>
          )}

          {/* Alterar status */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 font-semibold">Status</h3>
            <div className="flex flex-wrap gap-2">
              {flow.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(order.id, s)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    s === order.status
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {order.kitchenPrintStatus && (
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                {KITCHEN_PRINT_LABELS[order.kitchenPrintStatus]}
                {order.kitchenPrintedAt ? ` · ${formatTime(order.kitchenPrintedAt)}` : ""}
              </p>
            )}
            <button
              disabled={reprinting}
              onClick={() => {
                setReprinting(true);
                printManualTicket(order, unit)
                  .then(() => {
                    toast.success("Comanda reenviada para impressão.");
                  })
                  .catch((error) => {
                    console.error("[Maximus][print] Falha na reimpressao", error);
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível reimprimir a comanda.",
                    );
                  })
                  .finally(() => setReprinting(false));
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-accent disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {reprinting ? "Reimprimindo..." : "Reimprimir"}
            </button>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-2 font-semibold">Cliente</h3>
            <p className="text-sm">{order.customerName}</p>
            {order.customerPhone && (
              <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
            )}
          </div>

          {order.recipientName && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">Destinatário</h3>
              <p className="text-sm">{order.recipientName}</p>
              {order.recipientPhone && (
                <p className="text-sm text-muted-foreground">{order.recipientPhone}</p>
              )}
              {order.recipientNotes && (
                <p className="mt-2 text-xs text-muted-foreground">{order.recipientNotes}</p>
              )}
            </div>
          )}

          {order.type === "delivery" && order.address && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4 text-primary" /> Endereço
              </h3>
              <p className="text-sm text-muted-foreground">{order.address}</p>
              <p className="mt-3 text-xs font-bold text-muted-foreground">
                Localização confirmada: {hasDeliveryLocation ? "sim" : "não"}
              </p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                Origem: {locationSourceLabel(locationSource)}
              </p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                Coordenadas:{" "}
                {hasDeliveryLocation
                  ? `${deliveryLat.toFixed(6)}, ${deliveryLng.toFixed(6)}`
                  : "localização não confirmada"}
              </p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                GPS do entregador:{" "}
                {hasDriverLocation
                  ? order.status === "driver_on_way" || order.status === "out_for_delivery"
                    ? "entregador em rota"
                    : "localização autorizada"
                  : "sem localização"}
              </p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                Distância restante:{" "}
                {remainingDistanceKm != null
                  ? remainingDistanceKm < 1
                    ? `${Math.round(remainingDistanceKm * 1000)} m`
                    : `${remainingDistanceKm.toFixed(1)} km`
                  : "aguardando GPS"}
              </p>
              {hasDeliveryLocation && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${deliveryLat},${deliveryLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
                >
                  Ver no mapa
                </a>
              )}
            </div>
          )}

          {order.type === "mesa" && order.tableNumber != null && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <Utensils className="h-4 w-4 text-primary" /> Mesa
              </h3>
              <p className="text-xl font-bold">Mesa {String(order.tableNumber).padStart(2, "0")}</p>
            </div>
          )}

          {/* Pagamento */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-2 font-semibold">Pagamento</h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {PAYMENT_LABELS[order.paymentMethod]}
              </span>
              <PaymentBadge status={order.paymentStatus} />
            </div>

            {isPixApp && order.paymentStatus === "customer_reported_paid" && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-amber-400">
                  Cliente informou pagamento. Confirme manualmente se o Pix caiu.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPayment(order.id, "confirmed")}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    <Check className="h-4 w-4" /> Confirmar pagamento
                  </button>
                  <button
                    onClick={() => setPayment(order.id, "rejected")}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
                  >
                    <X className="h-4 w-4" /> Pagamento não encontrado
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function locationSourceLabel(source?: string) {
  if (source === "gps") return "GPS do cliente";
  if (source === "pin") return "Pin escolhido no mapa";
  return "localização não confirmada";
}
