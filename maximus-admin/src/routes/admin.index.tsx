import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Clock, DollarSign, Loader, Receipt, TrendingUp } from "lucide-react";
import { PageHeader } from "@/admin/components/AdminLayout";
import { PAYMENT_METHOD_LABELS, formatBRL, useAdmin, useDashboardStats } from "@/admin/store";
import { getDriverColor, getFinancialTone } from "@/admin/visual-tokens";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: "positive" | "negative" | "neutral" | "brand";
}) {
  const toneClasses = getFinancialTone(tone === "positive" ? 1 : tone === "negative" ? -1 : tone);
  return (
    <div className={`rounded-xl border bg-card p-5 shadow-sm ${toneClasses.border}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full border ${toneClasses.chip}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${toneClasses.text}`}>{value}</p>
    </div>
  );
}

function DashboardPage() {
  const { orders, selectedUnit, couriers, allProducts, categories } = useAdmin();
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [customStart, setCustomStart] = useState(todayInputValue());
  const [customEnd, setCustomEnd] = useState(todayInputValue());
  const periodOrders = filterOrdersByPeriod(orders, period, customStart, customEnd);
  const stats = useDashboardStats(periodOrders);
  const paymentCounts = countBy(periodOrders.map((order) => order.paymentMethod));
  const paymentStatusCounts = countBy(periodOrders.map((order) => order.paymentStatus));
  const categoryCounts = topCategories(periodOrders, allProducts, categories);
  const courierRanking = couriers
    .map((courier) => {
      const courierOrders = periodOrders.filter(
        (order) => (order.deliveryDriverId ?? order.courierId) === courier.id,
      );
      const deliveredOrders = courierOrders.filter((order) => order.delivery_completed_by_driver);
      const amount = deliveredOrders.reduce((sum, order) => sum + deliveryPayout(order), 0);
      return {
        id: courier.id,
        name: courier.name,
        total: courierOrders.length,
        delivered: deliveredOrders.length,
        amount,
      };
    })
    .sort((a, b) => b.delivered - a.delivered || b.amount - a.amount);
  const topCourier = courierRanking[0]?.delivered ? courierRanking[0].name : "Sem entregas";
  const topPayment = paymentCounts[0]?.[0]
    ? PAYMENT_METHOD_LABELS[paymentCounts[0][0] as keyof typeof PAYMENT_METHOD_LABELS]
    : "Sem dados";
  const totalDeliveries = courierRanking.reduce((sum, item) => sum + item.delivered, 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Visão geral do período · ${selectedUnit?.name ?? "Unidade"}`}
      />

      <PeriodFilter
        period={period}
        onPeriodChange={setPeriod}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Vendas do dia"
          value={formatBRL(stats.salesToday)}
          icon={DollarSign}
          tone="positive"
        />
        <StatCard label="Pedidos ativos" value={String(stats.activeCount)} icon={Loader} />
        <StatCard
          label="Pedidos finalizados"
          value={String(stats.finishedCount)}
          icon={CheckCircle2}
          tone="positive"
        />
        <StatCard
          label="Ticket médio"
          value={formatBRL(stats.ticket)}
          icon={Receipt}
          tone={stats.ticket > 0 ? "positive" : "neutral"}
        />
        <StatCard
          label="Taxas de entrega"
          value={formatBRL(stats.deliveryFees)}
          icon={DollarSign}
          tone={stats.deliveryFees > 0 ? "positive" : "neutral"}
        />
        <StatCard
          label="Pago aos entregadores"
          value={formatBRL(stats.driverPayout)}
          icon={DollarSign}
          tone={stats.driverPayout > 0 ? "positive" : "neutral"}
        />
        <StatCard
          label="Aguardando pagamento"
          value={String(stats.awaitingPaymentCount)}
          icon={Clock}
          tone={stats.awaitingPaymentCount > 0 ? "negative" : "neutral"}
        />
        <StatCard label="Total de pedidos" value={String(periodOrders.length)} icon={TrendingUp} />
        <StatCard label="Forma de pagamento líder" value={topPayment} icon={Receipt} />
        <StatCard label="Motoboy com mais entregas" value={topCourier} icon={TrendingUp} />
        <StatCard
          label="Total de entregas"
          value={String(totalDeliveries)}
          icon={CheckCircle2}
          tone={totalDeliveries > 0 ? "positive" : "neutral"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DonutPanel
          title="Entregadores"
          rows={courierRanking.map((driver) => ({
            id: driver.id,
            label: driver.name,
            value: driver.delivered,
            detail: `${driver.total} pedidos · ${formatBRL(driver.amount)}`,
            color: getDriverColor(driver.id),
          }))}
          empty="Sem entregas por entregador."
        />

        <DonutPanel
          title="Valor acumulado por entregador"
          rows={courierRanking.map((driver) => ({
            id: `${driver.id}-amount`,
            label: driver.name,
            value: driver.amount,
            detail: `${driver.delivered} entregas`,
            formattedValue: formatBRL(driver.amount),
            color: getDriverColor(driver.id),
          }))}
          empty="Sem valores acumulados."
        />

        <DonutPanel
          title="Produtos mais vendidos"
          rows={stats.topProducts.map((product) => ({
            id: product.name,
            label: product.name,
            value: product.qty,
            detail: `${product.qty} vendidos`,
          }))}
          empty="Sem produtos vendidos."
        />

        <DonutPanel
          title="Categorias mais vendidas"
          rows={categoryCounts.map(([label, value]) => ({
            id: label,
            label,
            value,
            detail: `${value} itens`,
          }))}
          empty="Sem categorias vendidas."
        />

        <DonutPanel
          title="Formas de pagamento"
          rows={paymentCounts.map(([label, value]) => ({
            id: label,
            label: PAYMENT_METHOD_LABELS[label as keyof typeof PAYMENT_METHOD_LABELS] ?? label,
            value,
            detail: `${value} pedidos`,
          }))}
          empty="Sem formas de pagamento."
        />

        <DonutPanel
          title="Status de pagamento"
          rows={paymentStatusCounts.map(([label, value]) => ({
            id: label,
            label: paymentStatusLabel(label),
            value,
            detail: `${value} pedidos`,
            tone: label === "confirmed" ? "positive" : label === "rejected" ? "negative" : "brand",
          }))}
          empty="Sem status de pagamento."
        />

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Acesso rápido</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickLink to="/admin/pedidos" label="Ver pedidos" />
            <QuickLink to="/admin/cardapio" label="Cardápio" />
            <QuickLink to="/admin/mesas" label="Mesas" />
            <QuickLink to="/admin/entrega" label="Entrega" />
          </div>
        </div>
      </div>
    </div>
  );
}

const CHART_COLORS = [
  "#f97316",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

type DonutRow = {
  id: string;
  label: string;
  value: number;
  detail: string;
  formattedValue?: string;
  tone?: "positive" | "negative" | "neutral" | "brand";
  color?: ReturnType<typeof getDriverColor>;
};

function DonutPanel({ title, rows, empty }: { title: string; rows: DonutRow[]; empty: string }) {
  const normalizedRows = rows.map((row) => ({
    ...row,
    chartValue: Math.abs(row.value),
    colorHex: getRowColor(row),
    toneClasses: getFinancialTone(
      row.tone ?? (row.value > 0 ? "positive" : row.value < 0 ? "negative" : "neutral"),
    ),
  }));
  const total = normalizedRows.reduce((sum, row) => sum + row.chartValue, 0);
  let offset = 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {normalizedRows.length ? (
        <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]">
          <div className="relative mx-auto aspect-square w-44">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke="rgba(148, 163, 184, 0.18)"
                strokeWidth="18"
              />
              {total > 0 &&
                normalizedRows.map((row) => {
                  const percent = (row.chartValue / total) * 100;
                  const segmentOffset = offset;
                  offset += percent;
                  return (
                    <circle
                      key={row.id}
                      cx="60"
                      cy="60"
                      r="42"
                      fill="none"
                      pathLength="100"
                      stroke={row.colorHex}
                      strokeDasharray={`${percent} ${100 - percent}`}
                      strokeDashoffset={-segmentOffset}
                      strokeWidth="18"
                    />
                  );
                })}
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Total</p>
                <p className="text-xl font-black">{formatChartTotal(normalizedRows, total)}</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {normalizedRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: row.colorHex }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.detail}</p>
                </div>
                <p
                  className={`shrink-0 text-sm font-black ${row.color?.text ?? row.toneClasses.text}`}
                >
                  {row.formattedValue ?? row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function getRowColor(row: DonutRow) {
  if (row.color) return row.color.hex;
  if (row.tone === "positive") return "#22c55e";
  if (row.tone === "negative") return "#ef4444";
  return CHART_COLORS[hashString(row.id) % CHART_COLORS.length];
}

function hashString(value: string) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function formatChartTotal(rows: Array<DonutRow & { chartValue: number }>, total: number) {
  if (!total) return "0";
  if (rows.some((row) => row.formattedValue)) return formatBRL(total);
  return String(total);
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg bg-secondary px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
    >
      {label}
    </Link>
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

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function filterOrdersByPeriod(
  orders: ReturnType<typeof useAdmin>["orders"],
  period: PeriodKey,
  customStart: string,
  customEnd: string,
) {
  const { start, end } = getPeriodRange(period, customStart, customEnd);
  return orders.filter((order) => {
    const time = new Date(order.deliveredAt ?? order.createdAt).getTime();
    return time >= start.getTime() && time <= end.getTime();
  });
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
    const customStartDate = customStart ? new Date(`${customStart}T00:00:00`) : start;
    const customEndDate = customEnd ? new Date(`${customEnd}T23:59:59.999`) : end;
    return { start: customStartDate, end: customEndDate };
  }

  return { start, end };
}

function countBy(values: string[]) {
  return Object.entries(
    values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
}

function topCategories(
  orders: ReturnType<typeof useAdmin>["orders"],
  products: ReturnType<typeof useAdmin>["allProducts"],
  categories: ReturnType<typeof useAdmin>["categories"],
) {
  const productCategory = new Map(products.map((product) => [product.name, product.categoryId]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const counts = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      const categoryId = productCategory.get(item.name);
      const label = categoryId ? (categoryName.get(categoryId) ?? categoryId) : "Sem categoria";
      counts.set(label, (counts.get(label) ?? 0) + item.quantity);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function deliveryPayout(order: ReturnType<typeof useAdmin>["orders"][number]) {
  const value =
    order.driverEarnedValue ??
    order.driver_earned_value ??
    order.deliveryPayoutAmount ??
    order.deliveryFeeSnapshot ??
    order.delivery_fee_snapshot ??
    order.deliveryFee ??
    order.delivery_fee ??
    order.courierFee ??
    0;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    customer_reported_paid: "Pagamento informado",
    confirmed: "Confirmado",
    rejected: "Rejeitado",
  };
  return labels[status] ?? status;
}
