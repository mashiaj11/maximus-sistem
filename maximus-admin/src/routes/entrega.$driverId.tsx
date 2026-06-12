import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Check, Clock, MapPin, Navigation, PackageCheck, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminProvider, formatBRL, formatElapsed, formatTime, useAdmin } from "@/admin/store";
import { STATUS_LABELS } from "@/admin/data/statuses";
import type { Order } from "@/admin/data/types";
import { DeliveryRouteMap } from "@/admin/components/MapView";
import { getDriverColor, getFinancialTone } from "@/admin/visual-tokens";

const logoUrl = "/branding/maximus-logo.png";
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
    units,
    updateStatus,
    setPayment,
    updateDriverLocation,
    startDeliveryNavigation,
    completeDeliveryByDriver,
  } = useAdmin();
  const [gpsStatus, setGpsStatus] = useState("GPS não solicitado");
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [selectedRouteOrders, setSelectedRouteOrders] = useState<Record<string, boolean>>({});
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
  const assignedOrders = useMemo(() => {
    const selected = routeMode
      ? assignedOrdersBase.filter((order) => selectedRouteOrders[order.id] !== false)
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
            {assignedOrders.length > 1 && (
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
                    {assignedOrdersBase.map((order, index) => (
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
                      const unit = units.find((item) => item.id === order.unitId);
                      const deliveryLat = order.deliveryLat ?? order.delivery_lat;
                      const deliveryLng = order.deliveryLng ?? order.delivery_lng;
                      const hasDestination = deliveryLat != null && deliveryLng != null;
                      const distanceToDestination = driverDistanceKm(driverLocation, order);
                      return (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-2xl font-black">#{order.number}</p>
                              <p className="mt-1 font-bold">{order.customerName}</p>
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
                            <p className="flex items-center gap-2 font-bold text-foreground">
                              <Navigation className="h-4 w-4 text-primary" />
                              Distância até destino: {formatDistance(distanceToDestination)}
                            </p>
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr]">
                            <button
                              type="button"
                              onClick={() => {
                                startDeliveryNavigation(order.id);
                                openNavigation(order, driverLocation);
                              }}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-4 text-base font-black text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              IR <Navigation className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => updateStatus(order.id, "out_for_delivery", "driver")}
                              disabled={order.status === "out_for_delivery"}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-3 text-sm font-extrabold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Saiu <Truck className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                completeDeliveryByDriver(
                                  order.id,
                                  order.paymentStatus === "confirmed" ||
                                    order.payment_confirmed === true,
                                )
                              }
                              disabled={order.delivery_completed_by_driver}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground sm:col-span-2"
                            >
                              {order.delivery_completed_by_driver ? "Já finalizado" : "Entregue"}{" "}
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setPayment(order.id, "confirmed", "driver")}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white sm:col-span-2"
                            >
                              Pagamento recebido <Check className="h-4 w-4" />
                            </button>
                          </div>

                          {hasDestination && (
                            <div className="mt-4">
                              <DeliveryRouteMap
                                origin={
                                  driverLocation
                                    ? {
                                        latitude: driverLocation.latitude,
                                        longitude: driverLocation.longitude,
                                        label: "Você",
                                        color: "#2563eb",
                                      }
                                    : unit
                                      ? {
                                          latitude: unit.latitude,
                                          longitude: unit.longitude,
                                          label: unit.name,
                                          color: "#f97316",
                                        }
                                      : undefined
                                }
                                destination={{
                                  latitude: deliveryLat,
                                  longitude: deliveryLng,
                                  label: "Cliente",
                                  color: "#22c55e",
                                }}
                              />
                            </div>
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

function destinationAddress(order: Order) {
  return (
    order.customerAddressText ??
    order.address ??
    [order.address_street, order.address_number, order.address_neighborhood]
      .filter(Boolean)
      .join(", ")
  );
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

function openNavigation(
  order: Order,
  driverLocation: { latitude: number; longitude: number } | null,
) {
  const deliveryLat = order.delivery_lat ?? order.deliveryLat;
  const deliveryLng = order.delivery_lng ?? order.deliveryLng;
  const address = destinationAddress(order);
  const waze =
    deliveryLat != null && deliveryLng != null
      ? `https://waze.com/ul?ll=${deliveryLat},${deliveryLng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
  const maps =
    deliveryLat != null && deliveryLng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${deliveryLat},${deliveryLng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/.test(userAgent);

  console.info("[Maximus][driver][navigation]", {
    pedido: order.id,
    latitudeEntregador: driverLocation?.latitude,
    longitudeEntregador: driverLocation?.longitude,
    latitudeDestino: deliveryLat,
    longitudeDestino: deliveryLng,
    enderecoDestino: address,
    distanciaAteDestinoKm: driverDistanceKm(driverLocation, order),
    metodo: deliveryLat != null && deliveryLng != null ? "coordenadas_pedido" : "endereco",
    wazeUrl: waze,
    fallbackMapsUrl: maps,
  });

  if (!isMobile) {
    window.open(waze, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.href = waze;
  window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.location.href = maps;
    }
  }, 1400);
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
