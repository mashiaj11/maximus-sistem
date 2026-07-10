import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/admin/components/AdminLayout";
import type { Order } from "@/admin/data/types";
import { formatBRL, useAdmin } from "@/admin/store";
import { getDriverColor, getFinancialTone } from "@/admin/visual-tokens";

export const Route = createFileRoute("/admin/entrega")({
  component: EntregaPage,
});

function normalizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function uniqueById(orders: Order[]) {
  return [...new Map(orders.map((order) => [order.id, order])).values()];
}

function deliveryPayout(order: Order) {
  const value =
    order.driverEarnedValue ??
    order.driver_earned_value ??
    order.deliveryPayoutAmount ??
    order.deliveryFeeSnapshot ??
    order.delivery_fee_snapshot ??
    order.deliveryFee ??
    order.delivery_fee ??
    order.courierFee;
  return Number.isFinite(value) ? value : null;
}

function isToday(iso?: string) {
  if (!iso) return false;
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function EntregaPage() {
  const {
    allOrders,
    couriers,
    deliveryZones,
    selectedUnit,
    addDeliveryZone,
    updateDeliveryZone,
    removeDeliveryZone,
    toggleDeliveryZone,
    saveDeliveryZones,
  } = useAdmin();
  const [saved, setSaved] = useState(false);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  const duplicateZones = useMemo(() => {
    const counts = new Map<string, number>();
    for (const zone of deliveryZones) {
      const key = zone.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name),
    );
  }, [deliveryZones]);

  const errors = useMemo(() => {
    const result: string[] = [];
    for (const zone of deliveryZones) {
      if (!zone.name.trim()) result.push("Zona/Bairro deve ter nome.");
      if (zone.fee < 0) result.push("Taxa deve ser maior ou igual a zero.");
      if ((zone.estimatedTimeMin ?? 0) < 0 || (zone.estimatedTimeMax ?? 0) < 0)
        result.push("Tempo estimado deve ser maior ou igual a zero.");
      if (
        zone.estimatedTimeMin != null &&
        zone.estimatedTimeMax != null &&
        zone.estimatedTimeMax < zone.estimatedTimeMin
      )
        result.push("Tempo máximo deve ser maior ou igual ao mínimo.");
    }
    if (duplicateZones.size > 0) result.push("Não é permitido ter zonas com o mesmo nome.");
    return [...new Set(result)];
  }, [deliveryZones, duplicateZones]);

  const canSave = errors.length === 0;
  const driverSummaries = useMemo(() => {
    return couriers
      .map((courier) => {
        const deliveredOrders = uniqueById(
          allOrders.filter(
            (order) =>
              order.type === "delivery" &&
              (order.deliveryDriverId ?? order.courierId ?? order.driver_id) === courier.id &&
              order.delivery_completed_by_driver &&
              isToday(order.deliveredAt ?? order.delivered_at),
          ),
        );
        const hasMissingFee = deliveredOrders.some((order) => deliveryPayout(order) == null);
        const total = deliveredOrders.reduce((sum, order) => sum + (deliveryPayout(order) ?? 0), 0);
        return {
          courier,
          deliveredOrders,
          hasMissingFee,
          total,
        };
      })
      .filter((summary) => summary.deliveredOrders.length > 0);
  }, [allOrders, couriers]);

  function handleSave() {
    if (!canSave) return;
    saveDeliveryZones();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="pb-20">
      <PageHeader
        title="Entrega"
        subtitle={selectedUnit?.name ?? "Unidade"}
        action={
          <button
            onClick={addDeliveryZone}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-secondary px-4 text-sm font-extrabold hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            Nova região
          </button>
        }
      />

      <section className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold">Regra de cálculo</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Taxa fixa por região do checkout.
            </p>
          </div>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            Zonas fixas
          </span>
        </div>
      </section>

      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold">Regiões</h2>
            <p className="mt-1 text-xs text-muted-foreground">Zonas ativas aparecem no checkout.</p>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
      </div>

      <section className="mb-4 rounded-lg border border-border bg-card p-3">
        <h2 className="text-base font-extrabold">Resumo por entregador</h2>
        <div className="mt-3 space-y-2">
          {driverSummaries.length ? (
            driverSummaries.map((summary) => (
              <div
                key={summary.courier.id}
                className={`rounded-md border bg-background p-2.5 ${getDriverColor(summary.courier.id).border}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-black">
                      <span
                        className={`h-3 w-3 rounded-full ${getDriverColor(summary.courier.id).dot}`}
                      />
                      {summary.courier.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {summary.deliveredOrders.length} entregas ·{" "}
                      <span
                        className={
                          summary.hasMissingFee
                            ? getFinancialTone("pending").text
                            : getFinancialTone(summary.total).text
                        }
                      >
                        {summary.hasMissingFee ? "sem taxa registrada" : formatBRL(summary.total)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDriverId((current) =>
                        current === summary.courier.id ? null : summary.courier.id,
                      )
                    }
                    className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
                  >
                    Ver entregas
                  </button>
                </div>
                {expandedDriverId === summary.courier.id && (
                  <div className="mt-3 space-y-2">
                    {summary.deliveredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="grid gap-2 rounded-md bg-card p-3 text-sm md:grid-cols-[1fr_auto]"
                      >
                        <div>
                          <p className="font-bold">Pedido #{order.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.customerName} · {order.address ?? "Sem endereço textual"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Região: {order.deliveryZoneName ?? "não registrada"}{" "}
                            · Tempo:{" "}
                            {order.deliveryEstimatedTime != null
                              ? `${order.deliveryEstimatedTime} min`
                              : "não registrado"}{" "}
                            · Taxa:{" "}
                            {formatBRL(
                              order.deliveryFeeSnapshot ??
                                order.delivery_fee_snapshot ??
                                order.deliveryFee ??
                                order.delivery_fee ??
                                0,
                            )}
                          </p>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Valor do entregador
                          </p>
                          <p
                            className={`font-black ${
                              deliveryPayout(order) == null
                                ? getFinancialTone("pending").text
                                : getFinancialTone(deliveryPayout(order) ?? 0).text
                            }`}
                          >
                            {deliveryPayout(order) == null
                              ? "sem taxa registrada"
                              : formatBRL(deliveryPayout(order) ?? 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(
                              order.deliveredAt ?? order.delivered_at ?? order.createdAt,
                            ).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p
                            className={`text-xs font-bold ${
                              order.payment_confirmed || order.paymentStatus === "confirmed"
                                ? getFinancialTone("confirmed").text
                                : getFinancialTone("pending").text
                            }`}
                          >
                            {order.payment_confirmed || order.paymentStatus === "confirmed"
                              ? "Pagamento confirmado"
                              : "Pagamento pendente"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma entrega finalizada por entregador hoje.
            </p>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Zona/Bairro</th>
              <th className="px-4 py-3 font-medium">Taxa</th>
              <th className="px-4 py-3 font-medium">Tempo estimado</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Resumo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {deliveryZones.map((zone) => {
              const duplicate = duplicateZones.has(zone.name.trim().toLowerCase());
              return (
                <tr key={zone.id} className="border-t border-border bg-background">
                  <td className="px-4 py-3">
                    <input
                      value={zone.name}
                      onChange={(event) =>
                        updateDeliveryZone(zone.id, { name: event.target.value })
                      }
                      className={`h-10 w-44 rounded-lg border bg-background px-3 text-sm ${
                        duplicate || !zone.name.trim() ? "border-red-500/60" : "border-input"
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={zone.fee}
                      onChange={(event) =>
                        updateDeliveryZone(zone.id, {
                          fee: normalizeNumber(Number(event.target.value)),
                        })
                      }
                      className={`h-10 w-28 rounded-lg border bg-background px-3 text-sm ${
                        zone.fee < 0 ? "border-red-500/60" : "border-input"
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={zone.estimatedTimeMin ?? 0}
                        onChange={(event) =>
                          updateDeliveryZone(zone.id, {
                            estimatedTimeMin: normalizeNumber(Number(event.target.value)),
                          })
                        }
                        className="h-10 w-20 rounded-lg border border-input bg-background px-3 text-sm"
                      />
                      <span className="text-muted-foreground">a</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={zone.estimatedTimeMax ?? 0}
                        onChange={(event) =>
                          updateDeliveryZone(zone.id, {
                            estimatedTimeMax: normalizeNumber(Number(event.target.value)),
                          })
                        }
                        className="h-10 w-20 rounded-lg border border-input bg-background px-3 text-sm"
                      />
                      <span className="font-semibold">min</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleDeliveryZone(zone.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        zone.isActive
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      {zone.isActive ? "Ativa" : "Inativa"}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-muted-foreground">
                    {zone.name || "Sem nome"} · {formatBRL(zone.fee)} ·{" "}
                    {zone.estimatedTimeMin || zone.estimatedTimeMax
                      ? `${zone.estimatedTimeMin ?? zone.estimatedTimeMax}-${zone.estimatedTimeMax ?? zone.estimatedTimeMin} min`
                      : "sem tempo"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeDeliveryZone(zone.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-accent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#18191b]/95 px-3 py-3 text-white shadow-none backdrop-blur md:left-56">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold">Entrega</p>
            <p className="text-[11px] text-white/60">
              {errors.length ? "Corrija as regiões antes de salvar." : "Taxas por zona"}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-xs font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/45"
          >
            {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Salvo" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
