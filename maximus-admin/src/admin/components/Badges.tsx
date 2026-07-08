import { STATUS_LABELS, TYPE_LABELS } from "../data/statuses";
import type { OrderStatus, OrderType, PaymentStatus } from "../data/types";
import { getFinancialTone } from "../visual-tokens";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const finals: OrderStatus[] = ["delivered", "delivered_to_table", "picked_up", "cancelled"];
  const done = finals.includes(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        done
          ? "bg-secondary text-muted-foreground"
          : "bg-primary/15 text-primary border border-primary/30"
      }`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TypeBadge({ type }: { type: OrderType }) {
  return (
    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-foreground">
      {TYPE_LABELS[type]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone = getFinancialTone(status);
  const label: Record<PaymentStatus, string> = {
    pending: "Pendente",
    customer_reported_paid: "Pagamento informado",
    confirmed: "Confirmado",
    rejected: "Rejeitado",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone.chip}`}
    >
      {label[status]}
    </span>
  );
}
