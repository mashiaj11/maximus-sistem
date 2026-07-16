import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Check, Clock, MapPin, Navigation, PackageCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminProvider, formatBRL, formatElapsed, formatTime, useAdmin } from "@/admin/store";
import { STATUS_LABELS } from "@/admin/data/statuses";
import type { Order } from "@/admin/data/types";
import { getDriverColor, getFinancialTone } from "@/admin/visual-tokens";

const logoUrl = "/branding/maximus-logo-transparent.png";
const EARTH_RADIUS_KM = 6371;

export const Route = createFileRoute("/entrega/$driverId")({
  component: EntregaDriverRoute,
});

function EntregaDriverRoute() {
  return (
    <AdminProvider>
      <DriverPanel />
    </AdminProvider>
  );
}

function DriverPanel() {
  const { driverId } = useParams({ from: "/entrega/$driverId" });
  const {
    allCouriers,
    allOrders,
    updateDriverLocation,
    startDeliveryNavigation,
    markDeliveryArrived,
    completeDeliveryByDriver,
    updateCourier,
  } = useAdmin();
  const [gpsStatus, setGpsStatus] = useState("GPS não solicitado");
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [selectedRouteOrders, setSelectedRouteOrders] = useState<Record<string, boolean>>({});
  const [savingActionByOrder, setSavingActionByOrder] = useState<
    Record<string, "navigation" | "arrived" | "delivered" | undefined>
  >({});
  const [deliveryErrorByOrder, setDeliveryErrorByOrder] = useState<Record<string, string>>({});
  const [navigationOrder, setNavigationOrder] = useState<Order | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const lastDriverUpdateRef = useRef(0);
  const driver = allCouriers.find((courier) => courier.id === driverId);
  const sessionDriverId =
    typeof window === "undefined" ? null : window.localStorage.getItem("maximus-driver-session");
  const sessionAllowed = sessionDriverId === driverId;

  const assignedOrdersBase = allOrders
    .filter(
      (order) =>
        order.type === "delivery" &&
        (order.deliveryDriverId ?? order.courierId) === driverId &&
        order.paymentStatus === "confirmed" &&
        !["delivered"].includes(order.status),
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const routeOrdersBase = assignedOrdersBase.filter((order) => order.status !== "arrived");
  const assignedOrders = useMemo(() => {
    const selected = routeMode
      ? assignedOrdersBase.filter(
          (order) => order.status === "arrived" || selectedRouteOrders[order.id] !== false,
        )
      : assignedOrdersBase;
    if (!routeMode || !driverLocation) return selected;
    return [...selected].sort(
      (a, b) => distanceFromDriver(driverLocation, a) - distanceFromDriver(driverLocation, b),
    );
  }, [assignedOrdersBase, driverLocation, routeMode, selectedRouteOrders]);
  const completedToday = allOrders
    .filter(
      (order) =>
        order.type === "delivery" &&
        (order.deliveryDriverId ?? order.courierId ?? order.driver_id) === driverId &&
        order.delivery_completed_by_driver &&
        isToday(order.deliveredAt ?? order.delivered_at),
    )
    .sort(
      (a, b) =>
        new Date(b.deliveredAt ?? b.delivered_at ?? b.createdAt).getTime() -
        new Date(a.deliveredAt ?? a.delivered_at ?? a.createdAt).getTime(),
    );
  const completedTotal = completedToday.reduce((sum, order) => sum + deliveryPayout(order), 0);
  const driverColor = getDriverColor(driver?.id ?? driverId);
  const hasDriver =
    Boolean(driver) && sessionAllowed && driver?.active && driver?.status !== "inativo";
  const assignedOrderIds = assignedOrdersBase.map((order) => order.id).join(",");

  useEffect(() => {
    if (!hasDriver) return;
    if (!navigator.geolocation) {
      setGpsStatus("GPS indisponível neste navegador");
      return;
    }
    setGpsStatus("Solicitando autorização de GPS em tempo real...");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setDriverLocation(location);
        setGpsStatus("Localização em tempo real ativa");
        console.info("[Maximus][driver][gps]", {
          latitudeEntregador: location.latitude,
          longitudeEntregador: location.longitude,
        });
        const now = Date.now();
        if (now - lastDriverUpdateRef.current < 8000) return;
        lastDriverUpdateRef.current = now;
        assignedOrderIds
          .split(",")
          .filter(Boolean)
          .forEach((orderId) =>
            updateDriverLocation(orderId, location.latitude, location.longitude),
          );
      },
      () => setGpsStatus("GPS negado ou indisponível"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [assignedOrderIds, hasDriver, updateDriverLocation]);

  return (
    <div className="admin-root min-h-screen font-sora">
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <header
          className={`mb-5 flex items-center gap-3 rounded-xl border bg-card p-4 ${driverColor.border}`}
        >
          <img src={logoUrl} alt="Maximus" className="h-11 w-11 object-contain" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Painel do entregador
            </p>
            <h1 className="flex items-center gap-2 truncate text-xl font-black">
              <span className={`h-3 w-3 rounded-full ${driverColor.dot}`} />
              {driver?.name ?? "Entregador não encontrado"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem("maximus-driver-session");
              window.location.href = "/entregador";
            }}
            className="ml-auto rounded-lg bg-secondary px-3 py-2 text-xs font-bold"
          >
            Sair
          </button>
        </header>

        {!hasDriver ? (
          <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Entregador inválido, inativo ou sessão expirada.
            <Link to="/entregador" className="mt-3 block font-bold text-primary">
              Entrar novamente
            </Link>
          </section>
        ) : (
          <>
            <section className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Pedidos
                </p>
                <p className="mt-1 text-2xl font-black">{assignedOrders.length}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Finalizadas hoje
                </p>
                <p className="mt-1 text-2xl font-black">{completedToday.length}</p>
                <p className={`mt-1 text-sm font-black ${getFinancialTone(completedTotal).text}`}>
                  {formatBRL(completedTotal)}
                </p>
              </div>
            </section>
            <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm font-semibold text-muted-foreground">
              {gpsStatus}
            </p>
            <section className="mb-4 rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Disponibilidade
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={availabilitySaving || driver?.status === "disponivel"}
                  onClick={async () => {
                    if (!driver) return;
                    setAvailabilitySaving(true);
                    try {
                      await updateCourier(driver.id, { status: "disponivel", active: true });
                    } finally {
                      setAvailabilitySaving(false);
                    }
                  }}
                  className={`rounded-lg px-4 py-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-70 ${
                    driver?.status === "disponivel" ? "bg-emerald-500 text-white" : "bg-secondary"
                  }`}
                >
                  Estou disponível
                </button>
                <button
                  type="button"
                  disabled={availabilitySaving || driver?.status === "em_entrega"}
                  onClick={async () => {
                    if (!driver) return;
                    setAvailabilitySaving(true);
                    try {
                      await updateCourier(driver.id, { status: "em_entrega", active: true });
                    } finally {
                      setAvailabilitySaving(false);
                    }
                  }}
                  className={`rounded-lg px-4 py-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-70 ${
                    driver?.status === "em_entrega" ? "bg-amber-500 text-black" : "bg-secondary"
                  }`}
                >
                  Estou indisponível
                </button>
              </div>
            </section>
            {routeOrdersBase.length > 1 && (
              <section className="mb-4 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-black">Rota de entregas</h2>
                    <p className="text-sm text-muted-foreground">
                      Ordena pela entrega mais próxima da sua localização atual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRouteMode((current) => !current)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground"
                  >
                    {routeMode ? "Rota ativa" : "Criar rota"}
                  </button>
                </div>
                {routeMode && (
                  <div className="mt-3 space-y-2">
                    {routeOrdersBase.map((order, index) => (
                      <label
                        key={order.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm"
                      >
                        <span className="font-bold">
                          {index + 1}. Pedido #{order.number} ·{" "}
                          {formatDistance(driverDistanceKm(driverLocation, order))}
                        </span>
                        <input
                          type="checkbox"
                          checked={selectedRouteOrders[order.id] ?? true}
                          onChange={(event) =>
                            setSelectedRouteOrders((current) => ({
                              ...current,
                              [order.id]: event.target.checked,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="space-y-3">
              {assignedOrders.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
                  Nenhuma entrega liberada para você agora.
                </div>
              ) : (
                assignedOrders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-border bg-card p-4">
                    {(() => {
                      const deliveryLat = order.deliveryLat ?? order.delivery_lat;
                      const deliveryLng = order.deliveryLng ?? order.delivery_lng;
                      const hasDestination = deliveryLat != null && deliveryLng != null;
                      const distanceToDestination = driverDistanceKm(driverLocation, order);
                      const hasArrived = order.status === "arrived";
                      const isAlreadyInRoute = Boolean(
                        order.navigationStartedAt ?? order.navigation_started_at,
                      );
                      const canMarkArrived =
                        order.status === "out_for_delivery" ||
                        order.status === "driver_on_way" ||
                        order.status === "driver_nearby";
                      const savingAction = savingActionByOrder[order.id];
                      return (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-2xl font-black">#{order.number}</p>
                              <p className="mt-1 font-bold">{order.customerName}</p>
                              {order.customerPhone && (
                                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                                  {order.customerPhone}
                                </p>
                              )}
                            </div>
                            <span
                              className={`rounded-lg border px-3 py-1 text-sm font-black ${getFinancialTone(deliveryPayout(order)).chip}`}
                            >
                              {formatBRL(deliveryPayout(order))}
                            </span>
                          </div>

                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <p className="flex items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <span>{order.address ?? "Endereço não informado"}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              Bairro: {order.address_neighborhood ?? "não informado"}
                            </p>
                            <p className="flex items-center gap-2 font-bold text-foreground">
                              <PackageCheck className="h-4 w-4 text-primary" />
                              Taxa:{" "}
                              {formatBRL(
                                order.deliveryFeeSnapshot ??
                                  order.delivery_fee_snapshot ??
                                  order.deliveryFee ??
                                  order.delivery_fee ??
                                  0,
                              )}
                            </p>
                            <p className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-primary" />
                              {formatTime(order.createdAt)} · {formatElapsed(order.createdAt)}
                            </p>
                            <p className="flex items-center gap-2">
                              <PackageCheck className="h-4 w-4 text-primary" />
                              {STATUS_LABELS[order.status]}
                            </p>
                            <p className="flex items-center gap-2">
                              <PackageCheck className="h-4 w-4 text-primary" />
                              Pagamento: {paymentLabel(order)}
                            </p>
                            <p className="flex items-center gap-2 font-bold text-foreground">
                              <Navigation className="h-4 w-4 text-primary" />
                              Distância até destino: {formatDistance(distanceToDestination)}
                            </p>
                            {order.notes && (
                              <p className="rounded-lg border border-primary/30 bg-primary/10 p-2 font-semibold text-primary">
                                Obs: {order.notes}
                              </p>
                            )}
                          </div>

                          {hasArrived ? (
                            <div className="mt-4 space-y-3">
                              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                                <p className="text-lg font-black text-primary">
                                  Você chegou ao local
                                </p>
                                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                                  Aguardando o cliente receber o pedido
                                </p>
                              </div>
                              <button
                                onClick={async () => {
                                  setDeliveryErrorByOrder((current) => ({
                                    ...current,
                                    [order.id]: "",
                                  }));
                                  setSavingActionByOrder((current) => ({
                                    ...current,
                                    [order.id]: "delivered",
                                  }));
                                  try {
                                    await completeDeliveryByDriver(
                                      order.id,
                                      order.paymentStatus === "confirmed" ||
                                        order.payment_confirmed === true,
                                    );
                                  } catch (error) {
                                    setDeliveryErrorByOrder((current) => ({
                                      ...current,
                                      [order.id]:
                                        error instanceof Error
                                          ? error.message
                                          : "Não foi possível finalizar o pedido.",
                                    }));
                                  } finally {
                                    setSavingActionByOrder((current) => ({
                                      ...current,
                                      [order.id]: undefined,
                                    }));
                                  }
                                }}
                                disabled={savingAction === "delivered"}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-4 text-base font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {savingAction === "delivered"
                                  ? "Finalizando..."
                                  : "Finalizar pedido"}
                                <Check className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setDeliveryErrorByOrder((current) => ({
                                      ...current,
                                      [order.id]: "",
                                    }));
                                    if (!hasDestination) {
                                      setDeliveryErrorByOrder((current) => ({
                                        ...current,
                                        [order.id]:
                                          "Pedido sem latitude/longitude congeladas para rota.",
                                      }));
                                      return;
                                    }
                                    if (!driverLocation) {
                                      setDeliveryErrorByOrder((current) => ({
                                        ...current,
                                        [order.id]: "GPS do entregador ainda não disponível.",
                                      }));
                                      return;
                                    }
                                    setSavingActionByOrder((current) => ({
                                      ...current,
                                      [order.id]: "navigation",
                                    }));
                                    try {
                                      if (!isAlreadyInRoute) {
                                        await startDeliveryNavigation(order.id, driverLocation);
                                      }
                                      setNavigationOrder(order);
                                    } catch (error) {
                                      setDeliveryErrorByOrder((current) => ({
                                        ...current,
                                        [order.id]:
                                          error instanceof Error
                                            ? error.message
                                            : "Não foi possível iniciar a rota.",
                                      }));
                                    } finally {
                                      setSavingActionByOrder((current) => ({
                                        ...current,
                                        [order.id]: undefined,
                                      }));
                                    }
                                  }}
                                  disabled={savingAction === "navigation"}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-4 text-base font-black text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {savingAction === "navigation"
                                    ? "Abrindo..."
                                    : isAlreadyInRoute
                                      ? "Abrir rota"
                                      : "IR"}{" "}
                                  <Navigation className="h-5 w-5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setDeliveryErrorByOrder((current) => ({
                                      ...current,
                                      [order.id]: "",
                                    }));
                                    setSavingActionByOrder((current) => ({
                                      ...current,
                                      [order.id]: "arrived",
                                    }));
                                    try {
                                      await markDeliveryArrived(order.id);
                                    } catch (error) {
                                      setDeliveryErrorByOrder((current) => ({
                                        ...current,
                                        [order.id]:
                                          error instanceof Error
                                            ? error.message
                                            : "Não foi possível marcar chegada.",
                                      }));
                                    } finally {
                                      setSavingActionByOrder((current) => ({
                                        ...current,
                                        [order.id]: undefined,
                                      }));
                                    }
                                  }}
                                  disabled={!canMarkArrived || savingAction === "arrived"}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingAction === "arrived" ? "Salvando..." : "Cheguei ao local"}
                                  <Check className="h-4 w-4" />
                                </button>
                              </div>

                              {hasDestination && (
                                <p className="mt-3 rounded-lg border border-border bg-background p-3 text-xs font-semibold text-muted-foreground">
                                  Destino fixado: {deliveryLat.toFixed(6)}, {deliveryLng.toFixed(6)}
                                </p>
                              )}
                            </>
                          )}

                          {deliveryErrorByOrder[order.id] && (
                            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                              {deliveryErrorByOrder[order.id]}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </article>
                ))
              )}
            </section>

            <section className="mt-5 rounded-xl border border-border bg-card p-4">
              <h2 className="text-lg font-black">Entregas finalizadas hoje</h2>
              <div className="mt-3 space-y-2">
                {completedToday.length ? (
                  completedToday.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-lg border border-border bg-background p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">Pedido #{order.number}</p>
                          <p className="text-muted-foreground">{order.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.address ?? "Sem endereço textual"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-black ${getFinancialTone(deliveryPayout(order)).text}`}
                          >
                            {formatBRL(deliveryPayout(order))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(order.deliveredAt ?? order.delivered_at ?? order.createdAt)}
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
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma entrega finalizada hoje.</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      {navigationOrder && driverLocation && (
        <NavigationChooser
          order={navigationOrder}
          driverLocation={driverLocation}
          onClose={() => setNavigationOrder(null)}
        />
      )}
    </div>
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

function paymentLabel(order: Order) {
  if (order.paymentMethod === "pix_app") {
    if (order.paymentStatus === "confirmed" || order.payment_confirmed) return "Pix confirmado";
    if (order.paymentStatus === "customer_reported_paid") return "Pix informado";
    if (order.paymentStatus === "rejected") return "Pix recusado";
    return "Pix pendente";
  }
  if (order.paymentMethod === "pix_balcao") return "Pix no balcão";
  if (order.paymentMethod === "local") return "Pagamento no local";
  if (order.paymentMethod === "cartao") return "Cartão";
  if (order.paymentMethod === "dinheiro") return "Dinheiro";
  return order.paymentMethod;
}

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

function orderDestination(order: Order) {
  const latitude = order.delivery_lat ?? order.deliveryLat;
  const longitude = order.delivery_lng ?? order.deliveryLng;
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

function driverDistanceKm(
  driverLocation: { latitude: number; longitude: number } | null,
  order: Order,
) {
  if (!driverLocation) return null;
  const destination = orderDestination(order);
  if (!destination) return null;
  return getDistanceKm(
    driverLocation.latitude,
    driverLocation.longitude,
    destination.latitude,
    destination.longitude,
  );
}

function distanceFromDriver(driverLocation: { latitude: number; longitude: number }, order: Order) {
  return driverDistanceKm(driverLocation, order) ?? Number.POSITIVE_INFINITY;
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm == null) return "sem coordenada";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

type NavigationApp = "google" | "apple" | "waze";

function getDevicePlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  return {
    isAndroid: /android/.test(userAgent),
    isIos: /iphone|ipad|ipod/.test(userAgent),
    isMobile: /android|iphone|ipad|ipod/.test(userAgent),
  };
}

function navigationLinks(
  app: NavigationApp,
  order: Order,
  driverLocation: { latitude: number; longitude: number },
) {
  const destination = orderDestination(order);
  if (!destination) throw new Error("Pedido sem latitude/longitude congeladas.");
  const origin = `${driverLocation.latitude},${driverLocation.longitude}`;
  const target = `${destination.latitude},${destination.longitude}`;
  if (app === "apple") {
    const web = `https://maps.apple.com/?saddr=${origin}&daddr=${target}&dirflg=d`;
    return { app: web, web };
  }
  if (app === "waze") {
    const web = `https://waze.com/ul?ll=${target}&navigate=yes`;
    return { app: web, web };
  }
  const web = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${target}&travelmode=driving`;
  return { app: web, web };
}

function openNavigationApp(
  app: NavigationApp,
  order: Order,
  driverLocation: { latitude: number; longitude: number },
) {
  const links = navigationLinks(app, order, driverLocation);
  const platform = getDevicePlatform();
  const destination = orderDestination(order);
  console.info("[Maximus][driver][navigation]", {
    pedido: order.id,
    app,
    latitudeEntregador: driverLocation.latitude,
    longitudeEntregador: driverLocation.longitude,
    latitudeDestino: destination?.latitude,
    longitudeDestino: destination?.longitude,
    distanciaAteDestinoKm: driverDistanceKm(driverLocation, order),
    metodo: "coordenadas_pedido",
    url: links.web,
  });

  if (!platform.isMobile) {
    window.open(links.web, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.href = links.app;
  window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.location.href = links.web;
    }
  }, 1400);
}

function NavigationChooser({
  order,
  driverLocation,
  onClose,
}: {
  order: Order;
  driverLocation: { latitude: number; longitude: number };
  onClose: () => void;
}) {
  const platform = getDevicePlatform();
  const apps: Array<{ key: NavigationApp; label: string }> = [
    { key: "google", label: "Google Maps" },
    ...(platform.isAndroid || !platform.isMobile
      ? []
      : [{ key: "apple" as const, label: "Apple Maps" }]),
    { key: "waze", label: "Waze" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="admin-root w-full max-w-sm rounded-xl border border-border bg-card p-5 font-sora shadow-xl">
        <h2 className="text-lg font-black">Abrir rota</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedido #{order.number} · escolha o aplicativo.
        </p>
        <div className="mt-4 grid gap-2">
          {apps.map((app) => (
            <button
              key={app.key}
              type="button"
              onClick={() => {
                openNavigationApp(app.key, order, driverLocation);
                onClose();
              }}
              className="rounded-lg bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground"
            >
              {app.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-4 py-3 text-sm font-bold"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
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
