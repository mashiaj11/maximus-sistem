import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import { TypeBadge } from "@/admin/components/Badges";
import { STATUS_LABELS, isFinalStatus } from "@/admin/data/statuses";
import type { Order } from "@/admin/data/types";
import {
  PAYMENT_METHOD_LABELS,
  formatBRL,
  formatTime,
  orderLocation,
  useAdmin,
} from "@/admin/store";

export const Route = createFileRoute("/admin/finalizados")({
  component: FinalizadosPage,
});

function paymentLabel(order: Order) {
  if (order.paymentMethod === "pix_app" && order.paymentStatus === "customer_reported_paid")
    return "Pix informado";
  if (order.paymentMethod === "pix_app" && order.paymentStatus === "pending") return "Pix pendente";
  if (order.paymentStatus === "rejected") return "Pix recusado";
  if (order.paymentMethod === "pix_app" && order.paymentStatus === "confirmed")
    return "Pix confirmado";
  return PAYMENT_METHOD_LABELS[order.paymentMethod];
}

function finishedAt(order: Order) {
  return order.deliveredAt ?? order.outForDeliveryAt ?? order.createdAt;
}

function totalTime(order: Order) {
  const started = new Date(order.createdAt).getTime();
  const finished = new Date(finishedAt(order)).getTime();
  const minutes = Math.max(0, Math.floor((finished - started) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function itemSummary(order: Order) {
  return order.items
    .map((item) => `${item.quantity}x ${item.name}`)
    .slice(0, 3)
    .join(" · ");
}

function driverName(order: Order) {
  return order.deliveryDriverName ?? order.courierName;
}

function FinalizadosPage() {
  const { orders, selectedUnit, resetOperationalData } = useAdmin();
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [customStart, setCustomStart] = useState(todayInputValue());
  const [customEnd, setCustomEnd] = useState(todayInputValue());
  const finishedOrders = [...orders]
    .filter((order) => isFinalStatus(order.status))
    .filter((order) => isInPeriod(finishedAt(order), period, customStart, customEnd))
    .sort((a, b) => new Date(finishedAt(b)).getTime() - new Date(finishedAt(a)).getTime());
  const summary = buildSummary(finishedOrders);

  return (
    <div>
      <PageHeader
        title="Finalizados"
        subtitle={`${selectedUnit?.name ?? "Unidade"} · ${finishedOrders.length} pedidos finalizados`}
      />
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={async () => {
            if (window.prompt("Digite ZERAR para limpar finalizados") !== "ZERAR") return;
            try {
              await resetOperationalData("finished_deliveries");
              toast.success("Finalizados limpos com sucesso.");
            } catch {
              toast.error("Não foi possível limpar finalizados.");
            }
          }}
          className="rounded-lg bg-destructive px-4 py-2 text-sm font-extrabold text-white"
        >
          Limpar finalizados
        </button>
      </div>

      <PeriodFilter
        period={period}
        onPeriodChange={setPeriod}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      <section className="mb-5 grid gap-3 md:grid-cols-5">
        <SummaryCard label="Pedidos" value={String(summary.count)} />
        <SummaryCard label="Faturamento" value={formatBRL(summary.revenue)} />
        <SummaryCard label="Taxas" value={formatBRL(summary.deliveryFees)} />
        <SummaryCard label="Entregadores" value={formatBRL(summary.driverPayout)} />
        <SummaryCard label="Ticket médio" value={formatBRL(summary.ticket)} />
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground">
          Produtos mais vendidos no período
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {summary.topProducts.length ? (
            summary.topProducts.map((product) => (
              <div
                key={product.name}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <span className="font-bold">{product.name}</span>
                <span className="text-primary font-black">{product.qty}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sem produtos vendidos no período.</p>
          )}
        </div>
      </section>

      {finishedOrders.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum pedido finalizado nesta unidade.
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {finishedOrders.map((order) => (
            <article
              key={order.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-black">#{order.number}</p>
                  <p className="mt-1 text-sm font-bold">
                    {order.type === "mesa" ? orderLocation(order) : order.customerName}
                  </p>
                </div>
                <TypeBadge type={order.type} />
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <InfoRow label="Status" value={STATUS_LABELS[order.status]} />
                <InfoRow label="Pagamento" value={paymentLabel(order)} />
                <InfoRow label="Total" value={formatBRL(order.total)} strong />
                <InfoRow label="Criado" value={formatTime(order.createdAt)} />
                <InfoRow label="Finalizado" value={formatTime(finishedAt(order))} />
                <InfoRow label="Tempo total" value={totalTime(order)} />
                {driverName(order) && (
                  <InfoRow label="Entregador" value={driverName(order) ?? ""} />
                )}
              </div>

              <div className="mt-4 rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Itens
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {itemSummary(order) || "Sem itens"}
                </p>
              </div>

              <Link
                to="/admin/pedidos/$id"
                params={{ id: order.id }}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-secondary px-3 py-2 text-sm font-semibold hover:bg-accent"
              >
                Ver detalhes
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? "font-black text-primary" : "font-semibold"}`}>
        {value}
      </span>
    </div>
  );
}

type PeriodKey = "today" | "week" | "month" | "quarter" | "custom";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hoje",
  week: "Semana",
  month: "Mês",
  quarter: "Trimestre",
  custom: "Personalizado",
};

function PeriodFilter({
  period,
  onPeriodChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
          <button
            key={key}
            onClick={() => onPeriodChange(key)}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${
              period === key ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            type="date"
            value={customStart}
            onChange={(event) => onCustomStartChange(event.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={customEnd}
            onChange={(event) => onCustomEndChange(event.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black text-primary">{value}</p>
    </div>
  );
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isInPeriod(iso: string, period: PeriodKey, customStart: string, customEnd: string) {
  const { start, end } = getPeriodRange(period, customStart, customEnd);
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function getPeriodRange(period: PeriodKey, customStart: string, customEnd: string) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === "week") start.setDate(start.getDate() - 6);
  if (period === "month") start.setMonth(start.getMonth() - 1);
  if (period === "quarter") start.setMonth(start.getMonth() - 3);
  if (period === "custom") {
    return {
      start: customStart ? new Date(`${customStart}T00:00:00`) : start,
      end: customEnd ? new Date(`${customEnd}T23:59:59.999`) : end,
    };
  }
  return { start, end };
}

function buildSummary(orders: Order[]) {
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const deliveryFees = orders.reduce(
    (sum, order) =>
      sum +
      (order.deliveryFeeSnapshot ??
        order.delivery_fee_snapshot ??
        order.deliveryFee ??
        order.delivery_fee ??
        0),
    0,
  );
  const driverPayout = orders.reduce(
    (sum, order) =>
      sum +
      (order.driverEarnedValue ??
        order.driver_earned_value ??
        order.deliveryPayoutAmount ??
        order.deliveryFeeSnapshot ??
        order.delivery_fee_snapshot ??
        0),
    0,
  );
  const productCounts = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      productCounts.set(item.name, (productCounts.get(item.name) ?? 0) + item.quantity);
    }
  }
  return {
    count: orders.length,
    revenue,
    deliveryFees,
    driverPayout,
    ticket: orders.length ? revenue / orders.length : 0,
    topProducts: [...productCounts.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6),
  };
}
