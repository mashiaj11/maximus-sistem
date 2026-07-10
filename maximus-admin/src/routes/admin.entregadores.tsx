import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import type { Courier, CourierStatus, Order } from "@/admin/data/types";
import { formatBRL, formatTime, useAdmin } from "@/admin/store";
import { STATUS_LABELS as ORDER_STATUS_LABELS, isFinalStatus } from "@/admin/data/statuses";
import { getDriverColor, getFinancialTone } from "@/admin/visual-tokens";

export const Route = createFileRoute("/admin/entregadores")({
  component: EntregadoresPage,
});

const STATUS_LABELS: Record<CourierStatus, string> = {
  disponivel: "Disponível",
  em_entrega: "Em entrega",
  inativo: "Inativo",
};

const STATUS_STYLE: Record<CourierStatus, string> = {
  disponivel: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  em_entrega: "border-primary/40 bg-primary/10 text-primary",
  inativo: "border-border bg-secondary text-muted-foreground",
};

const STATUS_OPTIONS: CourierStatus[] = ["disponivel", "em_entrega", "inativo"];

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

function EntregadoresPage() {
  const {
    couriers,
    orders,
    selectedUnit,
    addCourier,
    updateCourier,
    toggleCourier,
    deleteCourier,
  } = useAdmin();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [accessPin, setAccessPin] = useState("");
  const [status, setStatus] = useState<CourierStatus>("disponivel");
  const [editing, setEditing] = useState<Courier | null>(null);
  const [deleting, setDeleting] = useState<Courier | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finishedDeliveries = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.type === "delivery" &&
          Boolean(order.deliveryDriverId ?? order.courierId) &&
          isFinalStatus(order.status) &&
          isToday(order.deliveredAt ?? order.outForDeliveryAt ?? order.createdAt),
      ),
    [orders],
  );

  const summary = couriers.map((courier) => {
    const deliveries = finishedDeliveries.filter(
      (order) => (order.deliveryDriverId ?? order.courierId) === courier.id,
    );
    const total = deliveries.reduce((sum, order) => sum + deliveryPayout(order), 0);
    return { courier, deliveries, total };
  });

  const totals = {
    active: couriers.filter((courier) => courier.active).length,
    deliveries: finishedDeliveries.length,
    amount: summary.reduce((sum, item) => sum + item.total, 0),
  };

  return (
    <div>
      <PageHeader
        title="Entregadores"
        subtitle={selectedUnit?.name ?? "Unidade"}
      />
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={async () => {
            if (window.prompt("Digite ZERAR para remover entregadores inativos") !== "ZERAR")
              return;
            setBusy(true);
            try {
              for (const courier of couriers.filter(
                (item) => !item.active || item.status === "inativo",
              )) {
                await deleteCourier(courier.id);
              }
              toast.success("Entregadores inativos removidos.");
            } catch {
              toast.error("Não foi possível remover todos os inativos.");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-md bg-destructive px-3 py-1.5 text-xs font-extrabold text-white"
        >
          Remover todos os entregadores inativos
        </button>
      </div>

      <form
        className="mb-4 grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-[1fr_150px_140px_120px_130px_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          try {
            await addCourier({ name, phone, status, username, accessPin });
            setName("");
            setPhone("");
            setUsername("");
            setAccessPin("");
            setStatus("disponivel");
            toast.success("Entregador salvo.");
          } catch {
            toast.error("Não foi possível salvar o entregador.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome do entregador"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Telefone"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Usuário"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <input
          value={accessPin}
          onChange={(event) => setAccessPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="PIN"
          inputMode="numeric"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as CourierStatus)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      <section className="mb-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ativo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {couriers.map((courier) => {
              const isEditing = editing?.id === courier.id;
              return (
                <tr key={courier.id} className="border-t border-border bg-background">
                  <td className="px-4 py-3 font-semibold">
                    {isEditing ? (
                      <input
                        value={editing.name}
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      />
                    ) : (
                      courier.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {isEditing ? (
                      <input
                        value={editing.phone}
                        onChange={(event) => setEditing({ ...editing, phone: event.target.value })}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      />
                    ) : (
                      courier.phone
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={editing.username ?? ""}
                          onChange={(event) =>
                            setEditing({ ...editing, username: event.target.value })
                          }
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                        <input
                          value={editing.accessPin ?? ""}
                          onChange={(event) =>
                            setEditing({
                              ...editing,
                              accessPin: event.target.value.replace(/\D/g, "").slice(0, 8),
                            })
                          }
                          placeholder="Novo PIN"
                          inputMode="numeric"
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    ) : (
                      (courier.username ?? "-")
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={editing.status}
                        onChange={(event) =>
                          setEditing({ ...editing, status: event.target.value as CourierStatus })
                        }
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {STATUS_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[courier.status]}`}
                      >
                        {STATUS_LABELS[courier.status]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={async () => {
                        try {
                          await toggleCourier(courier.id);
                        } catch {
                          toast.error("Não foi possível alterar o entregador.");
                        }
                      }}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                        courier.active
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {courier.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await updateCourier(courier.id, {
                                name: editing.name,
                                phone: editing.phone,
                                username: editing.username,
                                accessPin: editing.accessPin,
                                status: editing.status,
                              });
                              setEditing(null);
                              toast.success("Entregador atualizado.");
                            } catch {
                              toast.error("Não foi possível atualizar o entregador.");
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded-md bg-secondary px-3 py-1.5 text-xs font-bold"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditing(courier)}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => setDeleting(courier)}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-accent"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-black">Resumo do dia</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Calculado automaticamente pelos pedidos delivery finalizados.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <SummaryBox label="Ativos" value={String(totals.active)} />
            <SummaryBox label="Entregas" value={String(totals.deliveries)} />
            <SummaryBox label="Total" value={formatBRL(totals.amount)} highlight />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {summary.map(({ courier, deliveries, total }) => (
            <div
              key={courier.id}
              className={`rounded-lg border bg-background p-3 ${getDriverColor(courier.id).border}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-extrabold">
                    <span className={`h-3 w-3 rounded-full ${getDriverColor(courier.id).dot}`} />
                    {courier.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {deliveries.length} entregas finalizadas hoje
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-lg border px-3 py-1 text-sm font-black ${getFinancialTone(total).chip}`}
                  >
                    {formatBRL(total)}
                  </span>
                  <button
                    onClick={() => setDetailsId(detailsId === courier.id ? null : courier.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
                  >
                    {detailsId === courier.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    Ver entregas
                  </button>
                </div>
              </div>
              {detailsId === courier.id && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {deliveries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma entrega finalizada hoje.
                    </p>
                  ) : (
                    deliveries.map((order) => <DeliveryRow key={order.id} order={order} />)
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {deleting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDeleting(null)}
        >
          <div
            className="admin-root w-full max-w-md rounded-xl border border-border bg-card p-6 font-sora"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-black">Excluir entregador?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Se houver entregas vinculadas hoje, o entregador será marcado como inativo para
              preservar o acerto.
            </p>
            <p className="mt-4 font-bold">{deleting.name}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await deleteCourier(deleting.id);
                    toast.success("Entregador removido.");
                    setDeleting(null);
                  } catch {
                    toast.error("Não foi possível excluir o entregador.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {busy ? "Excluindo..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryRow({ order }: { order: Order }) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3 text-sm md:grid-cols-[90px_1fr_90px_1fr_110px_100px] md:items-center">
      <span className="font-black">#{order.number}</span>
      <span>{order.customerName}</span>
      <span className="text-muted-foreground">
        {formatTime(order.deliveredAt ?? order.createdAt)}
      </span>
      <span className="truncate text-muted-foreground" title={order.address}>
        {order.address ?? "Endereço não informado"}
      </span>
      <span className="text-muted-foreground">{ORDER_STATUS_LABELS[order.status]}</span>
      <span className={`font-bold ${getFinancialTone(deliveryPayout(order)).text}`}>
        {formatBRL(deliveryPayout(order))}
      </span>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`min-w-24 rounded-lg border px-3 py-2 ${highlight ? "border-primary/40 bg-primary/10" : "border-border bg-background"}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-lg font-black ${highlight ? getFinancialTone(1).text : ""}`}>
        {value}
      </p>
    </div>
  );
}
