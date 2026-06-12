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

function normalizeNeighborhood(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
    deliveryRules,
    deliveryNeighborhoodRules,
    selectedUnit,
    addDeliveryRule,
    updateDeliveryRule,
    removeDeliveryRule,
    toggleDeliveryRule,
    saveDeliveryRules,
    addDeliveryNeighborhoodRule,
    updateDeliveryNeighborhoodRule,
    removeDeliveryNeighborhoodRule,
    toggleDeliveryNeighborhoodRule,
    saveDeliveryNeighborhoodRules,
  } = useAdmin();
  const [saved, setSaved] = useState(false);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  const duplicateDistances = useMemo(() => {
    const counts = new Map<number, number>();
    for (const rule of deliveryRules) {
      const key = Number(rule.maxDistanceKm.toFixed(2));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([distance]) => distance),
    );
  }, [deliveryRules]);

  const errors = useMemo(() => {
    const result: string[] = [];
    for (const rule of deliveryRules) {
      if (rule.maxDistanceKm <= 0) result.push("Distância deve ser maior que zero.");
      if (rule.estimatedMinutes <= 0) result.push("Tempo estimado deve ser maior que zero.");
      if (rule.deliveryFee < 0) result.push("Taxa deve ser maior ou igual a zero.");
    }
    if (duplicateDistances.size > 0)
      result.push("Não é permitido ter faixas com a mesma distância.");
    return [...new Set(result)];
  }, [deliveryRules, duplicateDistances]);

  const duplicateNeighborhoods = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rule of deliveryNeighborhoodRules) {
      const key = normalizeNeighborhood(rule.neighborhood);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [deliveryNeighborhoodRules]);

  const neighborhoodErrors = useMemo(() => {
    const result: string[] = [];
    for (const rule of deliveryNeighborhoodRules) {
      if (!rule.neighborhood.trim()) result.push("Bairro deve ser preenchido.");
      if (rule.estimatedMinutes <= 0)
        result.push("Tempo estimado por bairro deve ser maior que zero.");
      if (rule.deliveryFee < 0) result.push("Taxa por bairro deve ser maior ou igual a zero.");
    }
    if (duplicateNeighborhoods.size > 0)
      result.push("Não é permitido ter bairros duplicados na mesma unidade.");
    return [...new Set(result)];
  }, [deliveryNeighborhoodRules, duplicateNeighborhoods]);

  const canSave = errors.length === 0 && neighborhoodErrors.length === 0;
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
    saveDeliveryRules();
    saveDeliveryNeighborhoodRules();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div>
      <PageHeader
        title="Entrega"
        subtitle={`Taxa e tempo por distância · ${selectedUnit?.name ?? "Unidade"}`}
        action={
          <button
            onClick={addDeliveryRule}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-secondary px-4 text-sm font-extrabold hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            Nova faixa
          </button>
        }
      />

      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Faixas de entrega</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ordenadas automaticamente por distância crescente.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Salvo" : "Salvar alterações"}
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        {neighborhoodErrors.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {neighborhoodErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-extrabold">Resumo do dia por entregador</h2>
        <div className="mt-4 space-y-3">
          {driverSummaries.length ? (
            driverSummaries.map((summary) => (
              <div
                key={summary.courier.id}
                className={`rounded-lg border bg-background p-3 ${getDriverColor(summary.courier.id).border}`}
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
                            Distância:{" "}
                            {order.deliveryDistanceKm != null
                              ? `${order.deliveryDistanceKm.toFixed(1)} km`
                              : "não registrada"}{" "}
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

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Distância máxima</th>
              <th className="px-4 py-3 font-medium">Tempo estimado</th>
              <th className="px-4 py-3 font-medium">Taxa</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Resumo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {deliveryRules.map((rule) => {
              const duplicate = duplicateDistances.has(Number(rule.maxDistanceKm.toFixed(2)));
              return (
                <tr key={rule.id} className="border-t border-border bg-background">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Até</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={rule.maxDistanceKm}
                        onChange={(event) =>
                          updateDeliveryRule(rule.id, {
                            maxDistanceKm: normalizeNumber(Number(event.target.value)),
                          })
                        }
                        className={`h-10 w-24 rounded-lg border bg-background px-3 text-sm ${
                          duplicate || rule.maxDistanceKm <= 0
                            ? "border-red-500/60"
                            : "border-input"
                        }`}
                      />
                      <span className="font-semibold">km</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={rule.estimatedMinutes}
                      onChange={(event) =>
                        updateDeliveryRule(rule.id, {
                          estimatedMinutes: normalizeNumber(Number(event.target.value)),
                        })
                      }
                      className={`h-10 w-28 rounded-lg border bg-background px-3 text-sm ${
                        rule.estimatedMinutes <= 0 ? "border-red-500/60" : "border-input"
                      }`}
                    />
                    <span className="ml-2 font-semibold">min</span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={rule.deliveryFee}
                      onChange={(event) =>
                        updateDeliveryRule(rule.id, {
                          deliveryFee: normalizeNumber(Number(event.target.value)),
                        })
                      }
                      className={`h-10 w-28 rounded-lg border bg-background px-3 text-sm ${
                        rule.deliveryFee < 0 ? "border-red-500/60" : "border-input"
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleDeliveryRule(rule.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                        rule.isActive
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      {rule.isActive ? "Ativa" : "Inativa"}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-muted-foreground">
                    Até {rule.maxDistanceKm} km · {rule.estimatedMinutes} min ·{" "}
                    {formatBRL(rule.deliveryFee)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeDeliveryRule(rule.id)}
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

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Taxas por bairro</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Usadas quando o cliente informa endereço manual sem GPS.
            </p>
          </div>
          <button
            type="button"
            onClick={addDeliveryNeighborhoodRule}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-secondary px-4 text-sm font-extrabold hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            Novo bairro
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Bairro</th>
                <th className="px-4 py-3 font-medium">Tempo estimado</th>
                <th className="px-4 py-3 font-medium">Taxa</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Resumo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {deliveryNeighborhoodRules.map((rule) => {
                const duplicate = duplicateNeighborhoods.has(
                  normalizeNeighborhood(rule.neighborhood),
                );
                return (
                  <tr key={rule.id} className="border-t border-border bg-background">
                    <td className="px-4 py-3">
                      <input
                        value={rule.neighborhood}
                        onChange={(event) =>
                          updateDeliveryNeighborhoodRule(rule.id, {
                            neighborhood: event.target.value,
                          })
                        }
                        placeholder="Ex: Santíssimo"
                        className={`h-10 w-48 rounded-lg border bg-background px-3 text-sm ${
                          duplicate || !rule.neighborhood.trim()
                            ? "border-red-500/60"
                            : "border-input"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={rule.estimatedMinutes}
                        onChange={(event) =>
                          updateDeliveryNeighborhoodRule(rule.id, {
                            estimatedMinutes: normalizeNumber(Number(event.target.value)),
                          })
                        }
                        className={`h-10 w-28 rounded-lg border bg-background px-3 text-sm ${
                          rule.estimatedMinutes <= 0 ? "border-red-500/60" : "border-input"
                        }`}
                      />
                      <span className="ml-2 font-semibold">min</span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={rule.deliveryFee}
                        onChange={(event) =>
                          updateDeliveryNeighborhoodRule(rule.id, {
                            deliveryFee: normalizeNumber(Number(event.target.value)),
                          })
                        }
                        className={`h-10 w-28 rounded-lg border bg-background px-3 text-sm ${
                          rule.deliveryFee < 0 ? "border-red-500/60" : "border-input"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleDeliveryNeighborhoodRule(rule.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                          rule.isActive
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                            : "border-border bg-secondary text-muted-foreground"
                        }`}
                      >
                        {rule.isActive ? "Ativa" : "Inativa"}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-semibold text-muted-foreground">
                      {rule.neighborhood || "Bairro"} · {rule.estimatedMinutes} min ·{" "}
                      {formatBRL(rule.deliveryFee)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeDeliveryNeighborhoodRule(rule.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-accent"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
              {deliveryNeighborhoodRules.length === 0 && (
                <tr className="border-t border-border bg-background">
                  <td className="px-4 py-5 text-sm text-muted-foreground" colSpan={6}>
                    Nenhuma taxa por bairro cadastrada para esta unidade.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
