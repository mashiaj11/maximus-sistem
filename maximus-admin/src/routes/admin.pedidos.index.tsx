import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, ReceiptText, Truck, X } from "lucide-react";
import { PageHeader } from "@/admin/components/AdminLayout";
import { TypeBadge } from "@/admin/components/Badges";
import { isFinalStatus } from "@/admin/data/statuses";
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

type QueueKey = "novo" | "pagamento" | "preparo" | "pronto" | "saiu";

const QUEUES: { key: QueueKey; title: string }[] = [
  { key: "novo", title: "Novo" },
  { key: "pagamento", title: "Pagamento informado" },
  { key: "preparo", title: "Em preparo" },
  { key: "pronto", title: "Pronto" },
  { key: "saiu", title: "Saiu / Retirada" },
];

const PREP_STATUSES: OrderStatus[] = ["accepted", "in_preparation"];
const READY_STATUSES: OrderStatus[] = ["ready", "ready_for_pickup"];
const OUT_STATUSES: OrderStatus[] = ["out_for_delivery", "driver_on_way", "driver_nearby"];
function queueFor(order: Order): QueueKey | null {
  if (isFinalStatus(order.status)) return null;
  if (order.paymentMethod === "pix_app" && isPaymentBlocked(order)) return "pagamento";
  if (order.status === "received") return "novo";
  if (PREP_STATUSES.includes(order.status)) return "preparo";
  if (READY_STATUSES.includes(order.status)) return "pronto";
  if (OUT_STATUSES.includes(order.status)) return "saiu";
  return null;
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
  if (isPaymentPending(order)) return "Confirmar Pix";
  if (order.paymentStatus === "rejected") return "Pagamento bloqueado";
  if (order.paymentStatus === "pending") return "Aguardando cliente";
  if (order.status === "received") return "Aceitar pedido";
  if (order.status === "accepted") return "Iniciar produção";
  if (order.status === "in_preparation") return "Marcar pronto";
  if (READY_STATUSES.includes(order.status) && order.type === "delivery")
    return "Escolher entregador";
  if (READY_STATUSES.includes(order.status) && order.type === "mesa")
    return "Marcar entregue na mesa";
  if (READY_STATUSES.includes(order.status)) return "Liberar retirada";
  if (OUT_STATUSES.includes(order.status)) return "Concluir entrega";
  return "Avançar etapa";
}

function PedidoCard({
  order,
  onAssignCourier,
}: {
  order: Order;
  onAssignCourier: (order: Order) => void;
}) {
  const { updateStatus, advanceStatus, setPayment, selectedUnit } = useAdmin();
  const note = shortNote(order);
  const isReady = READY_STATUSES.includes(order.status);
  const isOut = OUT_STATUSES.includes(order.status);
  const driverPanelEnabled = selectedUnit?.driverPanelSettings?.enabled ?? false;
  const blockedByDriverPanel = isOut && order.type === "delivery" && driverPanelEnabled;
  const blockedByPayment = order.paymentStatus !== "confirmed";

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
    if (isReady && order.type === "delivery" && order.paymentStatus === "confirmed") {
      onAssignCourier(order);
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
      className={`rounded-lg border p-3 shadow-sm ${
        order.paymentStatus === "customer_reported_paid" ? "ring-1 ring-amber-400/50" : ""
      } ${urgencyClass(order)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-black">#{order.number}</p>
          <p className="mt-1 text-sm font-bold">
            {order.type === "mesa" ? orderLocation(order) : order.customerName}
          </p>
          {order.recipientName && (
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Para: {order.recipientName}
            </p>
          )}
        </div>
        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-bold text-muted-foreground">
          {formatElapsed(order.createdAt)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <TypeBadge type={order.type} />
        <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-bold">
          {paymentLabel(order)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 text-sm">
        <span className="font-black text-primary">{formatBRL(order.total)}</span>
      </div>

      {note && (
        <p className="mt-3 rounded-md border border-primary/30 bg-primary/10 p-2 text-xs font-semibold text-primary">
          {note}
        </p>
      )}

      <div className="mt-3 grid gap-2">
        {isPaymentPending(order) ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPayment(order.id, "confirmed")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500"
            >
              Confirmar pagamento
              <ReceiptText className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPayment(order.id, "rejected")}
              className="inline-flex items-center justify-center rounded-lg bg-destructive px-3 py-2.5 text-sm font-extrabold text-destructive-foreground hover:opacity-90"
            >
              Pagamento não encontrado
            </button>
          </div>
        ) : (
          !isFinalStatus(order.status) && (
            <div>
              <button
                onClick={runPrimaryAction}
                disabled={blockedByPayment || blockedByDriverPanel}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-extrabold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isOut ? "bg-emerald-600" : "bg-primary"
                }`}
              >
                {nextActionLabel(order)}
                {isPaymentPending(order) ? (
                  <ReceiptText className="h-4 w-4" />
                ) : order.type === "delivery" && (isReady || isOut) ? (
                  <Truck className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
              {blockedByDriverPanel && (
                <p className="mt-2 rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Painel do entregador ativo: a entrega deve ser concluída pelo entregador.
                </p>
              )}
            </div>
          )
        )}
        <Link
          to="/admin/pedidos/$id"
          params={{ id: order.id }}
          className="inline-flex items-center justify-center rounded-lg bg-secondary px-3 py-2 text-sm font-semibold hover:bg-accent"
        >
          Ver detalhes
        </Link>
      </div>
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

function PedidosPage() {
  const { orders, selectedUnit, couriers } = useAdmin();
  const [assigning, setAssigning] = useState<Order | null>(null);
  const sorted = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const activeCount = orders.filter((order) => !isFinalStatus(order.status)).length;

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle={`${selectedUnit?.name ?? "Unidade"} · ${activeCount} pedidos ativos · ${formatTime(new Date().toISOString())}`}
      />
      <div className="grid gap-4 xl:grid-cols-5">
        {QUEUES.map((queue) => {
          const queueOrders = sorted.filter((order) => queueFor(order) === queue.key);
          return (
            <section
              key={queue.key}
              className="min-w-0 rounded-lg border border-border bg-secondary/45 p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wide">{queue.title}</h2>
                <span className="rounded-md bg-card px-2 py-1 text-xs font-bold">
                  {queueOrders.length}
                </span>
              </div>

              <div className="grid gap-3">
                {queueOrders.length ? (
                  queueOrders.map((order) => (
                    <PedidoCard key={order.id} order={order} onAssignCourier={setAssigning} />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Sem pedidos.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <AssignCourierDialog
        order={assigning}
        couriers={couriers}
        onClose={() => setAssigning(null)}
      />
    </div>
  );
}
