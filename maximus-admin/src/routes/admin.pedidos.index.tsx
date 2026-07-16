import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  MapPinned,
  ReceiptText,
  Truck,
  X,
} from "lucide-react";
import { STATUS_LABELS, isFinalStatus } from "@/admin/data/statuses";
import type { Courier, Order, OrderStatus } from "@/admin/data/types";
import {
  PAYMENT_METHOD_LABELS,
  formatBRL,
  formatElapsed,
  formatTime,
  getUrgencyLevel,
  isPaymentBlocked,
  isPaymentPending,
  orderLocation,
  useAdmin,
} from "@/admin/store";
import { getDriverColor, getFinancialTone } from "@/admin/visual-tokens";

export const Route = createFileRoute("/admin/pedidos/")({
  component: PedidosPage,
});

type QueueKey = "entrada" | "producao" | "finalizacao";

const QUEUES: { key: QueueKey; title: string }[] = [
  { key: "entrada", title: "Novos pedidos" },
  { key: "producao", title: "Em produção" },
  { key: "finalizacao", title: "Entrega / Finalização" },
];

const PREP_STATUSES: OrderStatus[] = ["accepted", "in_preparation"];
const READY_STATUSES: OrderStatus[] = ["ready", "ready_for_pickup"];
const OUT_STATUSES: OrderStatus[] = [
  "out_for_delivery",
  "driver_on_way",
  "driver_nearby",
  "arrived",
];

function queueFor(order: Order): QueueKey | null {
  if (isFinalStatus(order.status)) return null;

  const hasCourier = order.type === "delivery" && Boolean(assignedCourierId(order));

  if (OUT_STATUSES.includes(order.status)) return "finalizacao";

  if (READY_STATUSES.includes(order.status)) {
    return hasCourier ? "finalizacao" : "producao";
  }

  if (order.status === "in_preparation") return "producao";

  if (
    order.status === "received" ||
    order.status === "accepted" ||
    isPaymentPending(order) ||
    isPaymentBlocked(order)
  ) {
    return "entrada";
  }

  return "entrada";
}

function urgencyClass(order: Order) {
  const urgency = getUrgencyLevel(order.createdAt);
  if (urgency === "late") return "border-red-300 bg-card";
  if (urgency === "attention") return "border-primary/35 bg-card";
  return "border-border bg-card";
}

function paymentLabel(order: Order) {
  if (order.paymentMethod === "pix_app" && order.paymentStatus === "customer_reported_paid")
    return "Informado";
  if (order.paymentMethod === "pix_app" && order.paymentStatus === "pending") return "Pix pendente";
  if (order.paymentStatus === "rejected") return "Pix recusado";
  if (order.paymentMethod === "pix_app" && order.paymentStatus === "confirmed") return "Confirmado";
  return PAYMENT_METHOD_LABELS[order.paymentMethod];
}

function shortNote(order: Order) {
  const note = order.notes?.trim();
  if (!note) return "";
  return note.length > 74 ? `${note.slice(0, 74)}...` : note;
}

function isToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function deliveryPayout(order: Order) {
  return (
    order.driverEarnedValue ??
    order.driver_earned_value ??
    order.deliveryPayoutAmount ??
    order.deliveryFeeSnapshot ??
    order.delivery_fee_snapshot ??
    order.deliveryFee ??
    order.delivery_fee ??
    order.courierFee ??
    0
  );
}

function assignedCourierId(order: Order) {
  return order.deliveryDriverId ?? order.courierId ?? order.driver_id;
}

function assignedCourierName(order: Order, couriers: Courier[]) {
  return (
    order.deliveryDriverName ??
    order.courierName ??
    order.driver_name ??
    couriers.find((courier) => courier.id === assignedCourierId(order))?.name
  );
}

function driverDeliveriesToday(orders: Order[], courierId: string) {
  return orders.filter(
    (order) =>
      order.type === "delivery" &&
      (order.deliveryDriverId ?? order.courierId) === courierId &&
      isFinalStatus(order.status) &&
      isToday(order.deliveredAt ?? order.outForDeliveryAt ?? order.createdAt),
  );
}

function nextActionLabel(order: Order) {
  const hasCourier = order.type === "delivery" && Boolean(assignedCourierId(order));

  if (isPaymentPending(order)) return "Confirmar pagamento";
  if (order.paymentStatus === "rejected") return "Pagamento bloqueado";
  if (order.paymentStatus === "pending") return "Aguardando cliente";

  if (order.status === "received") return "Aceitar pedido";
  if (order.status === "accepted") return "Iniciar produção";
  if (order.status === "in_preparation") return "Pedido pronto";

  if (READY_STATUSES.includes(order.status) && order.type === "delivery" && !hasCourier) {
    return "Escolher entregador";
  }

  if (READY_STATUSES.includes(order.status) && order.type === "delivery" && hasCourier) {
    return "Sair para entrega";
  }

  if (READY_STATUSES.includes(order.status) && order.type === "mesa") {
    return "Marcar entregue na mesa";
  }

  if (READY_STATUSES.includes(order.status)) return "Liberar retirada";

  if (OUT_STATUSES.includes(order.status)) return "Concluir pedido";

  return "Avançar etapa";
}

function PedidoCard({
  order,
  onAssignCourier,
  couriers,
  expanded,
  onToggleExpanded,
}: {
  order: Order;
  onAssignCourier: (order: Order) => void;
  couriers: Courier[];
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const { updateStatus, advanceStatus, setPayment } = useAdmin();
  const note = shortNote(order);
  const isReady = READY_STATUSES.includes(order.status);
  const isOut = OUT_STATUSES.includes(order.status);
  const blockedByPayment = order.paymentStatus !== "confirmed";
  const courierName = assignedCourierName(order, couriers);
  const hasAssignedCourier = order.type === "delivery" && Boolean(assignedCourierId(order));

  function runPrimaryAction() {
    if (isPaymentPending(order)) {
      setPayment(order.id, "confirmed");
      return;
    }
    if (order.status === "received") {
      updateStatus(order.id, "accepted");
      return;
    }
    if (order.status === "accepted") {
      updateStatus(order.id, "in_preparation");
      return;
    }
    if (order.status === "in_preparation") {
      updateStatus(
        order.id,
        order.type === "delivery" || order.type === "mesa" ? "ready" : "ready_for_pickup",
      );
      return;
    }
    if (isReady && order.type === "delivery") {
      if (!hasAssignedCourier) {
        onAssignCourier(order);
        return;
      }

      updateStatus(order.id, "out_for_delivery");
      return;
    }
    if (isReady) {
      updateStatus(order.id, order.type === "mesa" ? "delivered_to_table" : "picked_up");
      return;
    }
    if (isOut) {
      updateStatus(order.id, "delivered");
      return;
    }
    advanceStatus(order.id);
  }

  return (
    <article
      className={`overflow-hidden rounded-md border shadow-sm ${
        order.paymentStatus === "customer_reported_paid" ? "ring-1 ring-amber-400/50" : ""
      } ${urgencyClass(order)}`}
    >
      <button
        type="button"
        onClick={onToggleExpanded}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 px-2 py-1.5 text-left hover:bg-secondary/60"
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-extrabold leading-5">
            #{order.number} — {order.type === "mesa" ? orderLocation(order) : order.customerName}
          </p>
          <p className="truncate text-[10px] font-bold leading-4 text-muted-foreground">
            {order.type} • {formatBRL(order.total)} • {formatElapsed(order.createdAt)}
            {hasAssignedCourier ? ` • ${courierName ?? "Entregador"}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {hasAssignedCourier && (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0 text-[9px] font-extrabold leading-4 text-emerald-500">
              Atribuído
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-border px-2 py-1.5">
          <div className="rounded-md border border-border bg-background/70 p-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Detalhes
            </p>
            <div className="mt-1 space-y-1 text-[11px] font-semibold text-muted-foreground">
              <p>
                Local:{" "}
                {order.type === "mesa" ? orderLocation(order) : (order.address ?? "Sem endereço")}
              </p>
              <p>Pagamento: {paymentLabel(order)}</p>
              {hasAssignedCourier && <p>Entregador: {courierName ?? "Entregador"}</p>}
              {order.recipientName && <p>Para: {order.recipientName}</p>}
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/70 p-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Itens
            </p>
            <div className="mt-1 space-y-1.5">
              {order.items.map((item) => (
                <div key={item.id} className="text-[11px]">
                  <p className="font-extrabold">
                    {item.quantity}x {item.name}
                  </p>
                  {item.customizations.length > 0 && (
                    <p className="mt-0.5 text-muted-foreground">
                      {item.customizations.join(" · ")}
                    </p>
                  )}
                  {item.notes && <p className="mt-0.5 text-primary">Obs: {item.notes}</p>}
                </div>
              ))}
            </div>
          </div>

          {note && (
            <p className="rounded-md border border-primary/30 bg-primary/10 p-1.5 text-[11px] font-semibold text-primary">
              {note}
            </p>
          )}
        </div>
      )}

      {expanded && (
        <div className="grid gap-1.5 px-2 pb-2">
          {isPaymentPending(order) ? (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setPayment(order.id, "confirmed");
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-500"
              >
                Confirmar pagamento
                <ReceiptText className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setPayment(order.id, "rejected");
                }}
                className="inline-flex items-center justify-center rounded-md bg-destructive px-2 py-1.5 text-xs font-extrabold text-destructive-foreground hover:opacity-90"
              >
                Pagamento não encontrado
              </button>
            </div>
          ) : (
            !isFinalStatus(order.status) && (
              <div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    runPrimaryAction();
                  }}
                  disabled={blockedByPayment}
                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-extrabold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isOut ? "bg-emerald-600" : "bg-primary"
                  }`}
                >
                  {nextActionLabel(order)}
                  {isPaymentPending(order) ? (
                    <ReceiptText className="h-3.5 w-3.5" />
                  ) : order.type === "delivery" && (isReady || isOut) ? (
                    <Truck className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )
          )}
          <Link
            to="/admin/pedidos/$id"
            params={{ id: order.id }}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center justify-center rounded-md bg-secondary px-2 py-1.5 text-xs font-semibold hover:bg-accent"
          >
            Ver detalhes
          </Link>
        </div>
      )}
    </article>
  );
}

function AssignCourierDialog({
  order,
  couriers,
  onClose,
}: {
  order: Order | null;
  couriers: Courier[];
  onClose: () => void;
}) {
  const { assignDeliveryCourier, orders } = useAdmin();
  const available = couriers.filter((courier) => courier.active && courier.status === "disponivel");

  if (!order) return null;
  const orderPayout = deliveryPayout(order);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="admin-root w-full max-w-2xl rounded-xl border border-border bg-card p-6 font-sora"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Escolher entregador</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pedido #{order.number} · {order.customerName}
            </p>
            <p className="mt-1 text-sm font-bold text-primary">Corrida: {formatBRL(orderPayout)}</p>
          </div>
          <button onClick={onClose} className="rounded-md bg-secondary p-2 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {order.paymentStatus !== "confirmed" && (
          <p className="mt-5 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">
            Confirme o pagamento antes de liberar para entrega.
          </p>
        )}

        {order.paymentStatus === "confirmed" && available.length === 0 && (
          <p className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            Nenhum entregador disponível nesta unidade.
          </p>
        )}

        {order.paymentStatus === "confirmed" && (
          <div className="mt-5 grid gap-3">
            {available.map((courier) => {
              const deliveries = driverDeliveriesToday(orders, courier.id);
              const total = deliveries.reduce((sum, delivery) => sum + deliveryPayout(delivery), 0);
              const driverColor = getDriverColor(courier.id);
              return (
                <button
                  key={courier.id}
                  onClick={() => {
                    assignDeliveryCourier(order.id, courier.id);
                    onClose();
                  }}
                  className={`grid gap-3 rounded-xl border bg-background p-4 text-left hover:bg-primary/5 md:grid-cols-[1fr_auto] md:items-center ${driverColor.border}`}
                >
                  <div>
                    <p className="flex items-center gap-2 font-extrabold">
                      <span className={`h-3 w-3 rounded-full ${driverColor.dot}`} />
                      {courier.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {courier.phone || "Sem telefone"} · Status: disponível · {deliveries.length}{" "}
                      entregas hoje ·{" "}
                      <span className={getFinancialTone(total).text}>
                        {formatBRL(total)} acumulado
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground">
                    Escolher <Check className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DriverDeliveriesBoard({ couriers, orders }: { couriers: Courier[]; orders: Order[] }) {
  const [expandedCourierIds, setExpandedCourierIds] = useState<Record<string, boolean>>({});
  const activeCouriers = couriers
    .filter((courier) => courier.active)
    .sort((a, b) => {
      if (a.status === "disponivel" && b.status !== "disponivel") return -1;
      if (a.status !== "disponivel" && b.status === "disponivel") return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  const activeAssignedOrders = orders
    .filter(
      (order) =>
        order.type === "delivery" && assignedCourierId(order) && !isFinalStatus(order.status),
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  function toggleCourier(courierId: string) {
    setExpandedCourierIds((current) => ({ ...current, [courierId]: !current[courierId] }));
  }

  function openOrderRoute(order: Order) {
    const lat = order.delivery_lat ?? order.deliveryLat;
    const lng = order.delivery_lng ?? order.deliveryLng;
    if (lat == null || lng == null) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <aside className="min-w-0 rounded-md border border-border bg-secondary/20 p-1 xl:sticky xl:top-3 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto">
      <div className="mb-0.5 flex flex-wrap items-center justify-between gap-1">
        <div>
          <h2 className="text-xs font-extrabold">Entregadores</h2>
        </div>
      </div>
      <div className="grid gap-1">
        {activeCouriers.map((courier) => {
          const driverColor = getDriverColor(courier.id);
          const courierOrders = activeAssignedOrders.filter(
            (order) => assignedCourierId(order) === courier.id,
          );
          const expanded = Boolean(expandedCourierIds[courier.id]);
          return (
            <section
              key={courier.id}
              className={`min-w-0 rounded border bg-card px-1.5 py-0.5 ${driverColor.border}`}
            >
              <button
                type="button"
                onClick={() => toggleCourier(courier.id)}
                className="flex w-full items-center justify-between gap-1 text-left leading-none"
              >
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1 truncate text-[10px] font-extrabold leading-3">
                    <span className={`h-1.5 w-1.5 rounded-full ${driverColor.dot}`} />
                    {courier.name}
                  </h3>
                  <p className="text-[10px] font-semibold leading-3 text-muted-foreground">
                    {courier.status === "disponivel" ? "Disponível" : "Indisponível"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-0.5 rounded bg-secondary px-1 py-0 text-[9px] font-bold leading-3">
                  {courierOrders.length}
                  {expanded ? (
                    <ChevronDown className="h-2.5 w-2.5" />
                  ) : (
                    <ChevronRight className="h-2.5 w-2.5" />
                  )}
                </span>
              </button>

              {expanded && (
                <div className="mt-2 grid gap-1.5">
                  {courierOrders.length ? (
                    courierOrders.map((order) => {
                      const hasRoute =
                        (order.delivery_lat ?? order.deliveryLat) != null &&
                        (order.delivery_lng ?? order.deliveryLng) != null;
                      return (
                        <article
                          key={order.id}
                          className="rounded-md border border-border bg-background/80 p-1.5 text-[11px]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-black">#{order.number}</p>
                              <p className="truncate font-bold">{order.customerName}</p>
                            </div>
                            <span
                              className={`shrink-0 font-extrabold ${getFinancialTone(order.total).text}`}
                            >
                              {formatBRL(order.total)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="font-bold text-muted-foreground">
                              {formatElapsed(order.createdAt)}
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {STATUS_LABELS[order.status]}
                            </span>
                          </div>
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                            <Link
                              to="/admin/pedidos/$id"
                              params={{ id: order.id }}
                              className="inline-flex items-center justify-center rounded-md bg-secondary px-1.5 py-1 text-[11px] font-bold hover:bg-accent"
                            >
                              Ver pedido
                            </Link>
                            <button
                              type="button"
                              disabled={!hasRoute}
                              onClick={() => openOrderRoute(order)}
                              className="inline-flex items-center justify-center gap-1 rounded-md bg-secondary px-1.5 py-1 text-[11px] font-bold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <MapPinned className="h-2.5 w-2.5" />
                              Rota
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
                      Sem pedidos atribuídos.
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function PedidosPage() {
  const { orders, selectedUnit, couriers } = useAdmin();
  const [assigning, setAssigning] = useState<Order | null>(null);
  const [expandedOrderByQueue, setExpandedOrderByQueue] = useState<
    Partial<Record<QueueKey, string>>
  >({});
  const sorted = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const activeCount = orders.filter((order) => !isFinalStatus(order.status)).length;

  function toggleOrder(queue: QueueKey, orderId: string) {
    setExpandedOrderByQueue((current) => ({
      ...current,
      [queue]: current[queue] === orderId ? undefined : orderId,
    }));
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">Pedidos</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selectedUnit?.name ?? "Unidade"} · {activeCount} pedidos ativos ·{" "}
            {formatTime(new Date().toISOString())}
          </p>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(190px,220px)] xl:items-start">
        <section className="min-w-0">
          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[960px] grid-cols-3 gap-3">
              {QUEUES.map((queue) => {
                const queueOrders = sorted.filter((order) => queueFor(order) === queue.key);
                return (
                  <section
                    key={queue.key}
                    className="min-w-0 rounded-md border border-border bg-secondary/45 p-1.5"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <h2 className="truncate text-[11px] font-extrabold uppercase tracking-wide">
                        {queue.title}
                      </h2>
                      <span className="rounded-md bg-card px-1.5 py-0.5 text-[11px] font-bold">
                        {queueOrders.length}
                      </span>
                    </div>

                    <div className="grid gap-1">
                      {queueOrders.length ? (
                        queueOrders.map((order) => (
                          <PedidoCard
                            key={order.id}
                            order={order}
                            couriers={couriers}
                            expanded={expandedOrderByQueue[queue.key] === order.id}
                            onToggleExpanded={() => toggleOrder(queue.key, order.id)}
                            onAssignCourier={setAssigning}
                          />
                        ))
                      ) : (
                        <div className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
                          Sem pedidos.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>

        <DriverDeliveriesBoard couriers={couriers} orders={orders} />
      </div>

      <AssignCourierDialog
        order={assigning}
        couriers={couriers}
        onClose={() => setAssigning(null)}
      />
    </div>
  );
}
