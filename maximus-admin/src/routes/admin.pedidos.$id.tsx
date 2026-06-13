import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Utensils, Check, Printer, X } from "lucide-react";
import { PageHeader } from "@/admin/components/AdminLayout";
import { StatusBadge, TypeBadge, PaymentBadge } from "@/admin/components/Badges";
import { DeliveryRouteMap } from "@/admin/components/MapView";
import { useAdmin, formatBRL, formatTime } from "@/admin/store";
import { STATUS_FLOW, STATUS_LABELS } from "@/admin/data/statuses";
import { buildKitchenTicket } from "@/admin/printing";

export const Route = createFileRoute("/admin/pedidos/$id")({
  component: PedidoDetalhePage,
  notFoundComponent: () => <p className="text-muted-foreground">Pedido não encontrado.</p>,
});

const PAYMENT_LABELS: Record<string, string> = {
  pix_app: "Pix pelo app",
  pix_balcao: "Pix no balcão",
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

function printManualTicket(order: ReturnType<typeof useAdmin>["orders"][number]) {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank", "width=420,height=720");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(buildKitchenTicket(order));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 150);
}

function PedidoDetalhePage() {
  const { id } = useParams({ from: "/admin/pedidos/$id" });
  const { orders, units, updateStatus, setPayment } = useAdmin();
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
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Itens */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold mb-4">Itens do pedido</h2>
            <ul className="divide-y divide-border">
              {order.items.map((it) => (
                <li key={it.id} className="py-3 first:pt-0 last:pb-0">
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
            <div className="mt-4 flex justify-between border-t border-border pt-4 text-lg font-bold">
              <span>Total</span>
              <span>{formatBRL(order.total)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-2">Observações</h3>
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </div>
          )}

          {/* Alterar status */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-4">Alterar status</h3>
            <div className="flex flex-wrap gap-2">
              {flow.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(order.id, s)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
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
              onClick={() => printManualTicket(order)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-bold hover:bg-accent"
            >
              <Printer className="h-4 w-4" />
              Reimprimir
            </button>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Cliente</h3>
            <p className="text-sm">{order.customerName}</p>
            {order.customerPhone && (
              <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
            )}
          </div>

          {order.recipientName && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-3">Destinatário</h3>
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
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
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
                  href={`https://www.openstreetmap.org/?mlat=${deliveryLat}&mlon=${deliveryLng}#map=16/${deliveryLat}/${deliveryLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
                >
                  Ver no mapa
                </a>
              )}
            </div>
          )}

          {order.type === "delivery" && hasDeliveryLocation && (
            <div className="rounded-xl border border-border bg-card p-3">
              <DeliveryRouteMap
                className="h-56 w-full"
                origin={
                  unit
                    ? {
                        latitude: unit.latitude,
                        longitude: unit.longitude,
                        label: unit.name,
                        color: "#f97316",
                      }
                    : undefined
                }
                destination={{
                  latitude: deliveryLat,
                  longitude: deliveryLng,
                  label: "Cliente",
                  color: "#22c55e",
                }}
                driver={
                  hasDriverLocation
                    ? {
                        latitude: driverLat,
                        longitude: driverLng,
                        label: "Entregador",
                        color: "#2563eb",
                      }
                    : undefined
                }
              />
            </div>
          )}

          {order.type === "mesa" && order.tableNumber != null && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Utensils className="h-4 w-4 text-primary" /> Mesa
              </h3>
              <p className="text-2xl font-bold">
                Mesa {String(order.tableNumber).padStart(2, "0")}
              </p>
            </div>
          )}

          {/* Pagamento */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Pagamento</h3>
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
