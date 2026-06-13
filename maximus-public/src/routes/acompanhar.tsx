import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useCart, useOrder } from "@/lib/store";
import { STATUS_FLOWS, type OrderInfo } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  clearRememberedLastOrderId,
  getOrderInfo,
  getRememberedLastOrderId,
} from "@/lib/supabase-data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getDistanceKm } from "@/lib/geo";

export const Route = createFileRoute("/acompanhar")({
  head: () => ({
    meta: [
      { title: "Maximus" },
      { name: "description", content: "Sistema de pedidos da Maximus Hamburguer e Churrasco" },
    ],
  }),
  component: () => <TrackPageContent />,
});

export function TrackPageContent({ orderId: routeOrderId }: { orderId?: string }) {
  const navigate = useNavigate();
  const { clear } = useCart();
  const { order: contextOrder, placeOrder, clearOrder } = useOrder();
  const [loadedOrder, setLoadedOrder] = useState<OrderInfo | null>(null);
  const effectiveOrderId = routeOrderId ?? contextOrder?.id ?? getRememberedLastOrderId();
  const order =
    effectiveOrderId && contextOrder?.id !== effectiveOrderId
      ? loadedOrder
      : (contextOrder ?? loadedOrder);

  useEffect(() => {
    const loadOrder = () => {
      const orderId = routeOrderId ?? contextOrder?.id ?? getRememberedLastOrderId();
      if (!orderId) return;
      getOrderInfo(orderId)
        .then((result) => {
          if (!result) return;
          setLoadedOrder(result);
          placeOrder(result);
        })
        .catch(() => undefined);
    };

    loadOrder();

    const orderId = routeOrderId ?? contextOrder?.id ?? getRememberedLastOrderId();
    if (!isSupabaseConfigured || !orderId) return undefined;
    const channel = getSupabaseClient()
      .channel(`public-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => loadOrder(),
      )
      .subscribe();
    const poll = window.setInterval(loadOrder, 10000);

    return () => {
      getSupabaseClient().removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [contextOrder?.id, placeOrder, routeOrderId]);

  const steps = order ? STATUS_FLOWS[order.mode] : [];
  const current = order
    ? Math.max(
        0,
        steps.findIndex((step) => step.key === normalizeStatus(order.status)),
      )
    : 0;
  const remainingDistanceKm =
    order?.mode === "delivery" &&
    order.driverLat != null &&
    order.driverLng != null &&
    order.deliveryLat != null &&
    order.deliveryLng != null
      ? getDistanceKm(order.driverLat, order.driverLng, order.deliveryLat, order.deliveryLng)
      : null;
  const etaMinutes =
    remainingDistanceKm == null ? null : Math.max(3, Math.round((remainingDistanceKm / 25) * 60));
  const normalizedStatus = normalizeStatus(order?.status);
  const isFinished = ["delivered", "picked_up", "delivered_to_table"].includes(normalizedStatus);
  const isCancelled = normalizedStatus === "cancelled";

  function startNewOrder() {
    clear();
    clearOrder();
    clearRememberedLastOrderId();
    navigate({ to: "/menu" });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-10">
        {!order ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">Você ainda não tem um pedido em andamento.</p>
            <Button asChild className="mt-4 bg-gradient-primary font-bold">
              <Link to="/menu">Ver cardápio</Link>
            </Button>
          </div>
        ) : isCancelled ? (
          <FinalOrderScreen
            logoSrc="/branding/maximus-hero-logo.png"
            title="Pedido cancelado"
            description="Se precisar, entre em contato com a unidade para mais informações."
            buttonLabel="Fazer novo pedido"
            onNewOrder={startNewOrder}
            tone="cancelled"
          />
        ) : isFinished ? (
          <FinalOrderScreen
            logoSrc="/branding/maximus-hero-logo.png"
            title="Obrigado e volte sempre!"
            description="Seu pedido foi finalizado com sucesso."
            buttonLabel="Pedir novamente"
            onNewOrder={startNewOrder}
          />
        ) : (
          <>
            <div className="mb-8 rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Pedido {order.id}</p>
              <h1 className="mt-1 text-2xl font-extrabold">Acompanhe seu pedido</h1>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {order.mode === "delivery" && "Entrega (Delivery)"}
                  {order.mode === "mesa" && `Mesa ${order.table ?? ""}`}
                  {order.mode === "retirada" && "Retirada / Levar"}
                </span>
                <span className="font-bold text-primary">{formatPrice(order.total)}</span>
              </div>
              <p className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                Status atual: <strong>{currentLabel(order.status)}</strong>
              </p>
              {order.paymentStatus === "customer_reported_paid" && (
                <p className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">
                  Pagamento aguardando confirmação da Maximus.
                </p>
              )}
              {order.paymentStatus === "pending_on_delivery" && (
                <p className="mt-3 rounded-xl border border-border bg-secondary p-3 text-sm text-muted-foreground">
                  Pagamento pendente para entrega, retirada ou atendimento.
                </p>
              )}
            </div>

            <ol className="relative ml-3 border-l-2 border-border">
              {steps.map((step, i) => {
                const done = i < current;
                const isCurrent = i === current;
                return (
                  <li key={step.key} className="mb-7 ml-6">
                    <span
                      className={cn(
                        "absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border-2",
                        done && "border-primary bg-primary text-primary-foreground",
                        isCurrent && "border-primary bg-primary text-primary-foreground",
                        !done && !isCurrent && "border-border bg-background",
                      )}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : isCurrent ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                    </span>
                    <p
                      className={cn(
                        "font-semibold transition-colors",
                        isCurrent && "text-glow text-primary",
                        done && "text-foreground",
                        !done && !isCurrent && "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                  </li>
                );
              })}
            </ol>

            <section className="mt-8 rounded-2xl border border-border bg-card p-4">
              <h2 className="font-extrabold">Resumo do pedido</h2>
              <div className="mt-3 grid gap-2 text-sm">
                <InfoRow label="Unidade" value={order.unitName ?? order.unitSlug ?? "Maximus"} />
                <InfoRow label="Total" value={formatPrice(order.total)} strong />
                {order.mode === "delivery" && (
                  <>
                    <InfoRow
                      label="Endereço"
                      value={order.customerAddressText ?? "Endereço confirmado"}
                    />
                    <InfoRow
                      label="Distância aprox."
                      value={
                        order.deliveryDistanceKm != null
                          ? `${order.deliveryDistanceKm.toFixed(1)} km`
                          : "Calculando"
                      }
                    />
                    <InfoRow label="Taxa de entrega" value={formatPrice(order.deliveryFee ?? 0)} />
                    <InfoRow
                      label="Entregador"
                      value={
                        normalizeStatus(order.status) === "out_for_delivery" ||
                        normalizeStatus(order.status) === "driver_on_way" ||
                        normalizeStatus(order.status) === "driver_nearby"
                          ? "Saiu para entrega"
                          : "Aguardando saída"
                      }
                    />
                    <InfoRow
                      label="Distância restante"
                      value={
                        remainingDistanceKm != null
                          ? remainingDistanceKm < 1
                            ? `${Math.round(remainingDistanceKm * 1000)} m`
                            : `${remainingDistanceKm.toFixed(1)} km`
                          : "Aguardando GPS do entregador"
                      }
                    />
                    {etaMinutes != null && (
                      <InfoRow label="Previsão simples" value={`aprox. ${etaMinutes} min`} />
                    )}
                  </>
                )}
                <InfoRow label="Pagamento" value={paymentStatusLabel(order.paymentStatus)} />
              </div>
            </section>
          </>
        )}
      </div>
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

function FinalOrderScreen({
  logoSrc,
  title,
  description,
  buttonLabel,
  onNewOrder,
  tone = "success",
}: {
  logoSrc: string;
  title: string;
  description: string;
  buttonLabel: string;
  onNewOrder: () => void;
  tone?: "success" | "cancelled";
}) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-lg sm:px-10">
        <img
          src={logoSrc}
          alt="Maximus Hamburgueria"
          className="mx-auto h-20 w-auto max-w-[240px] object-contain sm:h-24"
        />
        <h1
          className={cn(
            "mt-8 text-3xl font-black sm:text-4xl",
            tone === "cancelled" ? "text-foreground" : "text-primary",
          )}
        >
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-medium text-muted-foreground sm:text-base">
          {description}
        </p>
        <Button onClick={onNewOrder} className="mt-8 bg-gradient-primary px-8 font-bold" size="lg">
          {buttonLabel}
        </Button>
      </div>
    </section>
  );
}

function paymentStatusLabel(status?: OrderInfo["paymentStatus"]) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    customer_reported_paid: "Pagamento informado",
    confirmed: "Confirmado",
    rejected: "Rejeitado",
    pending_on_delivery: "Pendente na entrega/retirada",
  };
  return labels[status ?? "pending"] ?? "Pendente";
}

function normalizeStatus(status?: string) {
  const map: Record<string, string> = {
    received: "received",
    recebido: "received",
    pending: "received",
    accepted: "accepted",
    aceito: "accepted",
    in_preparation: "in_preparation",
    preparing: "in_preparation",
    em_producao: "in_preparation",
    ready: "ready",
    pronto: "ready",
    ready_for_pickup: "ready_for_pickup",
    pronto_retirada: "ready_for_pickup",
    out_for_delivery: "out_for_delivery",
    saiu_entrega: "out_for_delivery",
    driver_on_way: "driver_on_way",
    a_caminho: "driver_on_way",
    driver_nearby: "driver_nearby",
    perto_500m: "driver_nearby",
    arrived: "arrived",
    chegou: "arrived",
    delivered: "delivered",
    entregue: "delivered",
    delivered_to_table: "delivered_to_table",
    entregue_mesa: "delivered_to_table",
    picked_up: "picked_up",
    retirado: "picked_up",
    cancelled: "cancelled",
    cancelado: "cancelled",
  };
  return map[status ?? ""] ?? "received";
}

function currentLabel(status?: string) {
  const normalized = normalizeStatus(status);
  const labels: Record<string, string> = {
    received: "Pedido recebido",
    accepted: "Pedido aceito",
    in_preparation: "Em produção",
    ready: "Pedido pronto",
    ready_for_pickup: "Pronto para retirada",
    out_for_delivery: "Saiu para entrega",
    driver_on_way: "Entregador a caminho",
    driver_nearby: "Entregador a 500 metros",
    arrived: "Pedido chegou",
    delivered: "Entregue",
    delivered_to_table: "Entregue na mesa",
    picked_up: "Retirado",
  };
  return labels[normalized] ?? "Pedido recebido";
}
