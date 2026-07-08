import { useEffect, useId, useMemo, useState, type HTMLAttributes } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, MapPin } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { LocationPickerMap } from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckoutShell, BigOption } from "@/components/checkout/CheckoutShell";
import { useCart, useOrder } from "@/lib/store";
import { formatPrice } from "@/lib/format";
import type {
  ConsumeMode,
  CustomerAddress,
  CustomerProfile,
  OrderInfo,
  OrderTrackMode,
} from "@/lib/types";
import { normalizeMesa } from "@/lib/utils";
import { type GeoUnit } from "@/lib/geo";
import {
  calculateDeliveryRoute,
  formatManualAddress,
  reverseGeocodeCoordinates,
  type GeocodingStatus,
  type ManualAddressForGeocoding,
} from "@/lib/geocoding";
import {
  deleteAddress,
  findCustomerByPhone,
  getCurrentCustomer,
  getSavedCustomerProfile,
  saveAddress,
  saveCustomer,
  saveSavedCustomerProfile,
  setDefaultAddress,
} from "@/lib/customer";
import {
  createOrderInSupabase,
  findPublicTable,
  loadDeliveryRules,
  loadPublicMenu,
  loadPublicTables,
  type PublicTable,
} from "@/lib/supabase-data";

type DeliveryRuleQuote = {
  id: string;
  maxDistanceKm: number;
  deliveryFee: number;
  estimatedMinutes: number;
  isActive: boolean;
};

type DeliveryQuote = {
  fee: number | null;
  distanceKm: number | null;
  deliveryRangeId: string | null;
  estimatedMinutes: number | null;
  minimumOrderValue: number;
  maxDistanceKm: number;
  isFree: boolean;
  method: "gps" | "manual_pin" | "blocked";
  blockedReason?: string;
};

interface CheckoutSearch {
  mesa?: string;
  table?: string;
  unidade?: string;
  unit?: string;
  mode?: string;
}

export const Route = createFileRoute("/checkout")({
  validateSearch: (s: Record<string, unknown>): CheckoutSearch => {
    const table = normalizeMesa(s.mesa ?? s.table ?? s.table_number);
    const unit =
      typeof s.unidade === "string"
        ? s.unidade
        : typeof s.unit === "string"
          ? s.unit
          : typeof s.unit_id === "string"
            ? s.unit_id
            : typeof s.unit_slug === "string"
              ? s.unit_slug
              : undefined;
    return {
      mesa: table,
      table,
      unidade: unit,
      unit,
      mode: typeof s.mode === "string" ? s.mode : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Maximus" },
      { name: "description", content: "Sistema de pedidos da Maximus Hamburguer e Churrasco" },
    ],
  }),
  component: CheckoutPage,
});

type Step =
  | "mode"
  | "contact"
  | "location"
  | "addressManual"
  | "payment"
  | "payDelivery"
  | "payCash"
  | "payCard"
  | "payPixDelivery"
  | "payApp"
  | "balcao"
  | "local"
  | "levar"
  | "mesaConfirm";

const EMPTY_ADDRESS = {
  label: "Casa" as CustomerAddress["label"],
  rua: "",
  numero: "",
  bairro: "",
  cep: "",
  complemento: "",
  referencia: "",
};

type DeliveryLocationSource = "gps" | "manual_pin" | "manual_unavailable";

type ResolvedDelivery = {
  location: { latitude: number; longitude: number } | null;
  unit: GeoUnit | null;
  distanceKm: number | null;
  deliveryRangeId: string | null;
  locationSource: DeliveryLocationSource;
  geocodingStatus: GeocodingStatus;
  displayAddress?: string;
};

type DeliveryRouteCandidate = GeoUnit & {
  distanceKm: number;
  deliveryLat: number;
  deliveryLng: number;
  durationMinutes: number | null;
  rawAddress: string | null;
  deliveryFee: number | null;
  deliveryRangeId: string | null;
  minimumOrderValueFromFunction: number | null;
  totalFromFunction: number | null;
};

async function resolveNearestDeliveryCandidate(
  units: GeoUnit[],
  subtotal: number,
  location: { latitude: number; longitude: number },
): Promise<DeliveryRouteCandidate | null> {
  const firstUnit = units[0];
  if (!firstUnit) return null;
  const unitsWithRules = await Promise.all(
    units.map(async (unit) => ({
      ...unit,
      deliveryRules: await loadDeliveryRules(unit.id),
    })),
  );
  const calculation = await calculateDeliveryRoute({
    unitLat: firstUnit.latitude,
    unitLng: firstUnit.longitude,
    unitId: firstUnit.id,
    unitName: firstUnit.name,
    subtotal,
    units: unitsWithRules,
    deliveryLat: location.latitude,
    deliveryLng: location.longitude,
  });
  const selectedUnit =
    units.find((unit) => unit.id === calculation.unitId) ??
    units.find((unit) => unit.name === calculation.unitName) ??
    null;
  if (!selectedUnit) return null;
  return {
    ...selectedUnit,
    distanceKm: calculation.distanceKm,
    deliveryLat: calculation.deliveryLat,
    deliveryLng: calculation.deliveryLng,
    durationMinutes: calculation.durationMinutes,
    rawAddress: calculation.rawAddress,
    deliveryFee: calculation.deliveryFee,
    deliveryRangeId: calculation.deliveryRangeId,
    minimumOrderValueFromFunction: calculation.minimumOrderValue,
    totalFromFunction: calculation.total,
  };
}

async function findNearestUnitByRoute(
  location: { latitude: number; longitude: number },
  units: GeoUnit[],
  subtotal: number,
): Promise<DeliveryRouteCandidate | null> {
  return resolveNearestDeliveryCandidate(units, subtotal, location);
}

function normalizeTableNumber(value?: string) {
  return value ? String(Number(value)).padStart(2, "0") : "";
}

function CheckoutPage() {
  const { mesa, table: tableParam, unidade, unit, mode } = Route.useSearch();
  const searchTable = mesa ?? tableParam;
  const searchUnit = unidade ?? unit;
  const search = useMemo(
    () => ({ unit: searchUnit, unidade: searchUnit, table: searchTable, mesa: searchTable, mode }),
    [mode, searchTable, searchUnit],
  );
  const navigate = useNavigate();
  const { items, subtotal, count, orderContext, setOrderContext } = useCart();
  const { placeOrder } = useOrder();
  const isStoredQrContext = orderContext?.source === "qr" || orderContext?.mode === "dine_in";
  const effectiveUnit = isStoredQrContext
    ? (orderContext?.unit ?? searchUnit)
    : (searchUnit ?? orderContext?.unit);
  const effectiveTable = isStoredQrContext
    ? (orderContext?.table ?? searchTable)
    : (searchTable ?? orderContext?.table);
  const effectiveMode = isStoredQrContext
    ? (orderContext?.mode ?? mode)
    : (mode ?? orderContext?.mode);
  const isQrDineIn = effectiveMode === "dine_in" && Boolean(effectiveTable);

  const [step, setStep] = useState<Step>("mode");
  const [consumeMode, setConsumeMode] = useState<ConsumeMode | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [table, setTable] = useState(effectiveTable ? normalizeTableNumber(effectiveTable) : "");
  const selectedUnitSlug = effectiveUnit;
  const [units, setUnits] = useState<GeoUnit[]>([]);
  const [unitTables, setUnitTables] = useState<PublicTable[]>([]);
  const displayMesa = table || normalizeTableNumber(effectiveTable);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [currentCustomer, setCurrentCustomer] = useState<CustomerProfile | null>(null);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [locating, setLocating] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [deliveryUnit, setDeliveryUnit] = useState<GeoUnit | null>(null);
  const [deliveryRules, setDeliveryRules] = useState<DeliveryRuleQuote[]>([]);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [deliveryRangeId, setDeliveryRangeId] = useState<string | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [deliveryLocationSource, setDeliveryLocationSource] =
    useState<DeliveryLocationSource>("manual_unavailable");
  const [deliveryAddressMode, setDeliveryAddressMode] = useState<"gps" | "other" | null>(null);
  const [pendingDelivery, setPendingDelivery] = useState<ResolvedDelivery | null>(null);
  const [geocodingStatus, setGeocodingStatus] = useState<GeocodingStatus>("not_needed");
  const [locationDenied, setLocationDenied] = useState(false);
  const [gpsAuthorized, setGpsAuthorized] = useState(false);
  const [noOpenUnits, setNoOpenUnits] = useState(false);
  const [needChange, setNeedChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  useEffect(() => {
    console.log("CHECKOUT QR FLAGS", {
      mode,
      mesa,
      table: tableParam,
      effectiveMode,
      effectiveTable,
      isQrDineIn,
    });
    console.log("CHECKOUT EFFECTIVE CONTEXT", {
      arquivo: "maximus-public/src/routes/checkout.tsx",
      search,
      orderContext,
      unit: effectiveUnit,
      table: effectiveTable,
      mesa: effectiveTable,
      table_id: undefined,
      table_number: effectiveTable,
      mode: effectiveMode,
      isQrDineIn,
      step,
      consumeMode,
    });
  }, [
    consumeMode,
    effectiveMode,
    effectiveTable,
    effectiveUnit,
    isQrDineIn,
    mesa,
    mode,
    orderContext,
    search,
    tableParam,
    step,
  ]);

  useEffect(() => {
    if (!isQrDineIn || !effectiveTable) return;
    setOrderContext({
      unit: effectiveUnit,
      table: effectiveTable,
      mode: "dine_in",
      source: orderContext?.source ?? "qr",
    });
    setTable(normalizeTableNumber(effectiveTable));
    if (consumeMode === "delivery" || consumeMode === "local" || consumeMode === "balcao") {
      setConsumeMode(null);
      setStep("mode");
    }
  }, [
    consumeMode,
    effectiveTable,
    effectiveUnit,
    isQrDineIn,
    orderContext?.source,
    setOrderContext,
  ]);

  useEffect(() => {
    const localProfile = getSavedCustomerProfile();
    if (localProfile) {
      setHasSavedProfile(true);
      setName(localProfile.name);
      setPhone(localProfile.phone);
      setSelectedAddressId(localProfile.last_address_id ?? "");
      setPrivacyConsent(true);
    }

    getCurrentCustomer()
      .then((customer) => {
        if (!customer) return;
        setCurrentCustomer(customer);
        setHasSavedProfile(true);
        setName(customer.name);
        setPhone(customer.phone);
        if (customer.email) setEmail(customer.email);
        const defaultAddress =
          customer.addresses.find((item) => item.id === localProfile?.last_address_id) ??
          customer.addresses.find((item) => item.isDefault) ??
          customer.addresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          fillAddress(defaultAddress);
          applySavedAddressLocation(defaultAddress);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadPublicMenu(selectedUnitSlug, isQrDineIn ? "dine_in" : "delivery")
      .then((data) => {
        setUnits(data.units);
        if (selectedUnitSlug) {
          const contextUnit =
            data.units.find(
              (unit) => unit.slug === selectedUnitSlug || unit.id === selectedUnitSlug,
            ) ?? null;
          setDeliveryUnit(contextUnit);
        }
      })
      .catch(() => undefined);
    if (selectedUnitSlug) {
      loadPublicTables(selectedUnitSlug)
        .then(setUnitTables)
        .catch(() => setUnitTables([]));
    } else {
      setUnitTables([]);
    }
  }, [isQrDineIn, selectedUnitSlug]);

  useEffect(() => {
    if (!deliveryUnit?.id) {
      setDeliveryRules([]);
      return;
    }
    loadDeliveryRules(deliveryUnit.id)
      .then(setDeliveryRules)
      .catch(() => setDeliveryRules([]));
  }, [deliveryUnit?.id]);

  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || currentCustomer?.phone === digits) return;

    const timeout = window.setTimeout(() => {
      findCustomerByPhone(phone)
        .then((customer) => {
          if (!customer) return;
          setCurrentCustomer(customer);
          setName((current) => current || customer.name);
          const defaultAddress =
            customer.addresses.find((item) => item.isDefault) ?? customer.addresses[0];
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
            fillAddress(defaultAddress);
            applySavedAddressLocation(defaultAddress);
          }
        })
        .catch(() => undefined);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [currentCustomer?.phone, phone]);

  const isAddressComplete =
    Boolean(address.rua.trim()) && Boolean(address.numero.trim()) && Boolean(address.bairro.trim());
  const allUnitsClosed = units.length > 0 && units.every((unit) => !unit.isOpen);

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <SiteHeader
          mesa={effectiveTable}
          unidade={effectiveUnit}
          mode={isQrDineIn ? "dine_in" : undefined}
        />
        <CheckoutShell title="Meu pedido está vazio">
          <Button
            className="w-full bg-gradient-primary font-bold"
            onClick={() =>
              navigate({
                to: "/menu",
                search: {
                  ...(effectiveUnit ? { unidade: effectiveUnit } : {}),
                  ...(effectiveTable ? { mesa: effectiveTable } : {}),
                  ...(isQrDineIn ? { mode: "dine_in" } : {}),
                },
              })
            }
          >
            Voltar ao cardápio
          </Button>
        </CheckoutShell>
      </div>
    );
  }

  if (allUnitsClosed) {
    return (
      <div className="min-h-screen">
        <SiteHeader
          mesa={effectiveTable}
          unidade={effectiveUnit}
          mode={isQrDineIn ? "dine_in" : undefined}
        />
        <CheckoutShell title="Estamos fechados agora">
          <div className="space-y-4">
            <p className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-muted-foreground">
              O checkout está indisponível porque todas as unidades estão fechadas no momento.
              Consulte a página Onde estamos para ver endereços e horários.
            </p>
            <Button
              className="w-full bg-gradient-primary font-bold"
              onClick={() => navigate({ to: "/onde-estamos" })}
            >
              Ver unidades e horários
            </Button>
          </div>
        </CheckoutShell>
      </div>
    );
  }

  async function persistCustomer() {
    if (!name.trim() || !phone.trim()) return currentCustomer;
    if (!hasSavedProfile && !privacyConsent) {
      toast.error("Para continuar, aceite os termos de uso e a política de privacidade.");
      return null;
    }
    const customer = await saveCustomer({ name, phone });
    setCurrentCustomer(customer);
    setHasSavedProfile(true);
    saveSavedCustomerProfile({
      name: customer.name,
      phone: customer.phone,
      customer_id: customer.id,
      last_address_id: selectedAddressId || customer.addresses.find((item) => item.isDefault)?.id,
    });
    return customer;
  }

  function currentAddressDraft(
    location = deliveryLocation,
  ): Omit<CustomerAddress, "id" | "createdAt" | "updatedAt"> {
    return {
      label: address.label,
      street: address.rua.trim(),
      number: address.numero.trim(),
      neighborhood: address.bairro.trim(),
      complement: address.complemento.trim() || undefined,
      reference: address.referencia.trim() || undefined,
      isDefault: saveAsDefault,
      latitude: location?.latitude,
      longitude: location?.longitude,
    };
  }

  function fillAddress(saved: CustomerAddress) {
    setAddress({
      label: saved.label,
      rua: saved.street,
      numero: saved.number,
      bairro: saved.neighborhood,
      cep: "",
      complemento: saved.complement ?? "",
      referencia: saved.reference ?? "",
    });
    setSaveAsDefault(saved.isDefault);
  }

  function applySavedAddressLocation(saved: CustomerAddress) {
    if (saved.latitude == null || saved.longitude == null) return;
    setDeliveryAddressMode("other");
    applyDeliveryLocation({ latitude: saved.latitude, longitude: saved.longitude }, "manual_pin");
  }

  async function saveCurrentAddress(customerId: string, location = deliveryLocation) {
    const saved = await saveAddress(customerId, {
      ...currentAddressDraft(location),
      id: editingAddressId ?? undefined,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    setCurrentCustomer(saved);
    const latest =
      saved.addresses.find((item) => item.id === editingAddressId) ?? saved.addresses.at(-1);
    if (latest) {
      setSelectedAddressId(latest.id);
      setEditingAddressId(null);
      saveSavedCustomerProfile({
        name: saved.name,
        phone: saved.phone,
        customer_id: saved.id,
        last_address_id: latest.id,
      });
    }
    return latest;
  }

  async function finalize(
    mode: OrderTrackMode,
    extra?: {
      table?: string;
      paymentStatus?: OrderInfo["paymentStatus"];
      paymentMethod?: OrderInfo["paymentMethod"];
    },
  ) {
    if (submitting) return;
    if (units.length > 0 && units.every((unit) => !unit.isOpen)) {
      toast.error("Todas as unidades estão fechadas no momento.");
      return;
    }
    if (isQrDineIn && mode === "delivery") {
      toast.error("Delivery não está disponível para pedidos iniciados por QR de mesa.");
      setConsumeMode(null);
      setStep("mode");
      return;
    }
    setSubmitting(true);
    let resolvedDelivery: ResolvedDelivery | null = null;
    if (mode === "delivery") {
      resolvedDelivery =
        pendingDelivery ??
        (deliveryAddressMode === "gps" && deliveryLocation
          ? {
              location: deliveryLocation,
              unit: deliveryUnit,
              distanceKm: deliveryDistanceKm,
              deliveryRangeId,
              locationSource: "gps",
              geocodingStatus,
            }
          : await resolveManualAddressLocation());
      if (!resolvedDelivery?.location) {
        toast.error("Confirme o local da entrega pelo GPS ou marque no mapa.");
        setSubmitting(false);
        return;
      }
    }
    const unit =
      mode === "delivery"
        ? resolvedDelivery?.unit
        : selectedUnitSlug
          ? units.find((item) => item.slug === selectedUnitSlug || item.id === selectedUnitSlug)
          : null;
    const customer = await persistCustomer();
    let usedAddress: CustomerAddress | undefined;
    let tableId: string | null = null;
    if (mode === "delivery" && customer) {
      try {
        usedAddress = selectedAddressId
          ? currentCustomer?.addresses.find((item) => item.id === selectedAddressId)
          : undefined;
        if (!usedAddress) {
          usedAddress = await saveCurrentAddress(customer.id, resolvedDelivery?.location ?? null);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar o endereço.");
        setSubmitting(false);
        return;
      }
    }
    if (mode === "mesa" && unit?.slug && extra?.table) {
      const publicTable = await findPublicTable(unit.slug, extra.table);
      tableId = publicTable?.id ?? null;
      if (!tableId) {
        toast.error("Mesa não encontrada no Supabase.");
        setSubmitting(false);
        return;
      }
    }
    if (!unit) {
      toast.error("Não foi possível identificar a unidade do pedido.");
      setSubmitting(false);
      return;
    }
    if (!unit.isOpen) {
      toast.error("A unidade selecionada está fechada no momento.");
      setSubmitting(false);
      return;
    }
    const quote =
      mode === "delivery"
        ? calculateDeliveryQuote({
            subtotal,
            unit,
            distanceKm: resolvedDelivery?.distanceKm ?? null,
            rules: await loadRulesForResolvedUnit(unit),
            neighborhood: usedAddress?.neighborhood ?? address.bairro,
            locationSource: resolvedDelivery?.locationSource ?? deliveryLocationSource,
          })
        : null;
    const minimumOrderValue = quote?.minimumOrderValue ?? 0;
    if (mode === "delivery" && subtotal < minimumOrderValue) {
      toast.error(`Pedido mínimo para delivery: ${formatPrice(minimumOrderValue)}.`);
      setSubmitting(false);
      return;
    }
    if (mode === "delivery" && (!quote || quote.fee == null)) {
      toast.error(quote?.blockedReason ?? "Não foi possível calcular a taxa de entrega.");
      setSubmitting(false);
      return;
    }
    const deliveryFee = mode === "delivery" ? (quote?.fee ?? 0) : 0;
    if (mode === "delivery") {
      console.info("[Maximus][checkout][delivery-final]", {
        endereco: usedAddress
          ? formatManualAddress({
              street: usedAddress.street,
              number: usedAddress.number,
              neighborhood: usedAddress.neighborhood,
              city: "Santarém",
              state: "PA",
            })
          : address,
        bairro: usedAddress?.neighborhood ?? address.bairro,
        latitudeCliente: resolvedDelivery?.location?.latitude,
        longitudeCliente: resolvedDelivery?.location?.longitude,
        unidadeAtribuida: deliveryQuoteUnitLabel(unit),
        distanciaCalculadaKm: resolvedDelivery?.distanceKm,
        taxaCalculada: deliveryFee,
        metodo: quote?.method,
        geocodingStatus: resolvedDelivery?.geocodingStatus,
      });
    }

    const draft: Omit<OrderInfo, "id" | "createdAt"> = {
      mode,
      total: subtotal + deliveryFee,
      paymentStatus: extra?.paymentStatus,
      paymentMethod: extra?.paymentMethod,
      table: extra?.table,
      customerName: name || undefined,
      customerPhone: customer?.phone ?? phone,
      customerId: customer?.id,
      recipientName: undefined,
      recipientPhone: undefined,
      recipientNotes: undefined,
      address: usedAddress,
      items: items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        total: item.unitPrice * item.quantity,
      })),
      unitId: unit?.id,
      unitSlug: unit?.slug,
      unitName: unit?.name,
      unitLat: unit?.latitude,
      unitLng: unit?.longitude,
      deliveryDistanceKm: resolvedDelivery?.distanceKm ?? null,
      deliveryFee,
      deliveryRangeId: resolvedDelivery?.deliveryRangeId ?? quote?.deliveryRangeId ?? null,
      minimumOrderValue,
      deliveryLat: resolvedDelivery?.location?.latitude,
      deliveryLng: resolvedDelivery?.location?.longitude,
      deliveryLocationSource: resolvedDelivery?.locationSource ?? deliveryLocationSource,
      geocodingStatus: resolvedDelivery?.geocodingStatus ?? geocodingStatus,
      customerLat: resolvedDelivery?.location?.latitude,
      customerLng: resolvedDelivery?.location?.longitude,
      customerAddressText: usedAddress
        ? formatManualAddress({
            street: usedAddress.street,
            number: usedAddress.number,
            neighborhood: usedAddress.neighborhood,
            city: "Santarém",
            state: "PA",
          })
        : undefined,
    };
    try {
      const saved = await createOrderInSupabase({
        order: draft,
        cartItems: items,
        customerId: customer?.id,
        addressId: usedAddress?.id,
        unitId: unit.id,
        tableId,
        deliveryFee,
        deliveryDistanceKm: resolvedDelivery?.distanceKm ?? null,
        deliveryRangeId: resolvedDelivery?.deliveryRangeId ?? quote?.deliveryRangeId ?? null,
      });
      const order: OrderInfo = {
        ...draft,
        id: saved.id,
        total: saved.total,
        createdAt: saved.createdAt,
      };
      placeOrder(order);
      if (customer) {
        saveSavedCustomerProfile({
          name: customer.name,
          phone: customer.phone,
          customer_id: customer.id,
          last_address_id: usedAddress?.id ?? selectedAddressId ?? undefined,
        });
      }
      if (extra?.paymentStatus === "customer_reported_paid") {
        toast.success("Pedido enviado. Pagamento aguardando confirmação da Maximus.");
      } else {
        toast.success("Pedido enviado!");
      }
      navigate({ to: "/acompanhar/$id", params: { id: order.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestGeolocation() {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      setStep("addressManual");
      return;
    }

    setLocating(true);
    setDeliveryAddressMode("gps");
    setPendingDelivery(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        console.info("[Maximus][checkout][gps] coords capturadas", location);
        setGpsAuthorized(true);
        let nearest: DeliveryRouteCandidate | null = null;
        try {
          nearest = await applyDeliveryLocation(location, "gps");
        } catch (error) {
          setLocating(false);
          toast.error(error instanceof Error ? error.message : "Não foi possível calcular a rota.");
          return;
        }
        let reverseResult: Awaited<ReturnType<typeof reverseGeocodeCoordinates>> = null;
        try {
          reverseResult = await reverseGeocodeCoordinates(location.latitude, location.longitude);
        } catch (error) {
          console.warn("[Maximus][Nominatim][reverse] falha", error);
        }

        if (reverseResult) {
          setAddress((current) => ({
            ...current,
            rua: reverseResult.street || current.rua,
            numero: reverseResult.number || current.numero,
            bairro: reverseResult.neighborhood || current.bairro,
            referencia: reverseResult.displayName || current.referencia,
          }));
        }

        const hasMainFields = Boolean(
          reverseResult?.street && reverseResult.neighborhood && reverseResult.number,
        );
        setLocating(false);
        if (hasMainFields) {
          toast.success("Localização confirmada.");
        } else {
          toast.info("Localização encontrada. Complete o endereço manualmente.");
        }
        const gpsRules = nearest ? await loadRulesForResolvedUnit(nearest) : [];
        const gpsQuote = calculateDeliveryQuote({
          subtotal,
          unit: nearest,
          distanceKm: nearest?.distanceKm ?? null,
          rules: gpsRules,
          neighborhood: reverseResult?.neighborhood ?? address.bairro,
          locationSource: "gps",
        });
        console.info("[Maximus][checkout][gps] validação", {
          coords: location,
          address: reverseResult,
          ruaExtraida: reverseResult?.street,
          numeroExtraido: reverseResult?.number,
          bairroExtraido: reverseResult?.neighborhood,
          unidadeEscolhida: deliveryQuoteUnitLabel(nearest),
          taxaCalculada: gpsQuote.fee,
          motivoSemUnidade: nearest ? null : "nenhuma unidade aberta para as coordenadas",
        });
        setStep("addressManual");
      },
      () => {
        setLocating(false);
        setLocationDenied(true);
        setStep("addressManual");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function applyDeliveryLocation(
    location: { latitude: number; longitude: number },
    source: DeliveryLocationSource,
  ) {
    const nearest =
      (await findNearestUnitByRoute(
        location,
        units.filter((unit) => unit.isOpen),
        subtotal,
      )) ?? (await findNearestUnitByRoute(location, units, subtotal));
    if (!nearest) {
      setDeliveryLocation(location);
      setDeliveryLocationSource(source);
      setGeocodingStatus(source === "gps" ? "gps_confirmed" : "not_needed");
      setDeliveryUnit(null);
      setDeliveryDistanceKm(null);
      setDeliveryRangeId(null);
      setLocationConfirmed(true);
      setLocationDenied(false);
      setNoOpenUnits(false);
      return null;
    }
    setDeliveryLocation({
      latitude: nearest.deliveryLat,
      longitude: nearest.deliveryLng,
    });
    setDeliveryLocationSource(source);
    setGeocodingStatus(source === "gps" ? "gps_confirmed" : "not_needed");
    setDeliveryUnit(nearest);
    setDeliveryDistanceKm(nearest.distanceKm);
    setDeliveryRangeId(nearest.deliveryRangeId);
    setLocationConfirmed(true);
    setLocationDenied(false);
    setNoOpenUnits(false);
    return nearest;
  }

  async function resolveManualAddressLocation() {
    try {
      setPendingDelivery(null);
      const manualAddress = {
        street: address.rua.trim(),
        number: address.numero.trim(),
        neighborhood: address.bairro.trim(),
        city: "Santarém",
        state: "Pará",
        postalCode: address.cep.trim() || undefined,
      } satisfies ManualAddressForGeocoding;

      if (!deliveryLocation) {
        setDeliveryLocationSource("manual_unavailable");
        setGeocodingStatus("not_needed");
        return {
          location: null,
          unit: null,
          distanceKm: null,
          deliveryRangeId: null,
          locationSource: "manual_unavailable" as const,
          geocodingStatus: "not_needed" as GeocodingStatus,
        };
      }

      const nearest = await applyDeliveryLocation(
        deliveryLocation,
        deliveryLocationSource === "gps" ? "gps" : "manual_pin",
      );
      if (!nearest) {
        return {
          location: deliveryLocation,
          unit: null,
          distanceKm: null,
          deliveryRangeId: null,
          locationSource: deliveryLocationSource === "gps" ? "gps" : ("manual_pin" as const),
          geocodingStatus:
            deliveryLocationSource === "gps" ? "gps_confirmed" : ("not_needed" as GeocodingStatus),
        };
      }

      const location = { latitude: nearest.deliveryLat, longitude: nearest.deliveryLng };
      setDeliveryLocation(location);
      setDeliveryLocationSource(deliveryLocationSource === "gps" ? "gps" : "manual_pin");
      setDeliveryUnit(nearest);
      setDeliveryDistanceKm(nearest.distanceKm);
      setDeliveryRangeId(nearest.deliveryRangeId);
      setLocationConfirmed(true);
      setGeocodingStatus(deliveryLocationSource === "gps" ? "gps_confirmed" : "not_needed");
      setDeliveryAddressMode("other");

      console.info("[Maximus][checkout][delivery-pin]", {
        metodo: deliveryLocationSource === "gps" ? "gps" : "manual_pin",
        enderecoReferencia: formatManualAddress(manualAddress),
        latitudeCliente: nearest.deliveryLat,
        longitudeCliente: nearest.deliveryLng,
        unidadeAtribuida: deliveryQuoteUnitLabel(nearest),
        distanciaKm: nearest.distanceKm,
      });

      const resolved = {
        location,
        unit: nearest,
        distanceKm: nearest.distanceKm,
        deliveryRangeId: nearest.deliveryRangeId,
        locationSource: deliveryLocationSource === "gps" ? "gps" : ("manual_pin" as const),
        geocodingStatus:
          deliveryLocationSource === "gps" ? "gps_confirmed" : ("not_needed" as GeocodingStatus),
        displayAddress: formatManualAddress(manualAddress),
      };
      setPendingDelivery(resolved);
      return resolved;
    } catch (error) {
      setDeliveryDistanceKm(null);
      setDeliveryRangeId(null);
      setDeliveryUnit(null);
      console.warn("[Maximus][delivery-function] falha ao calcular entrega", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Confirme o local da entrega pelo GPS ou marque no mapa.",
      );
      return {
        location: null,
        unit: null,
        distanceKm: null,
        deliveryRangeId: null,
        locationSource: "manual_unavailable" as const,
        geocodingStatus: "not_needed" as GeocodingStatus,
      };
    }
  }

  async function loadRulesForResolvedUnit(unit: GeoUnit | null) {
    if (!unit) return [];
    return unit.id === deliveryUnit?.id ? deliveryRules : await loadDeliveryRules(unit.id);
  }

  function resolveManualDeliveryUnit() {
    if (deliveryLocation) return deliveryUnit;
    if (!selectedUnitSlug) return deliveryUnit;
    return (
      units.find(
        (item) => (item.slug === selectedUnitSlug || item.id === selectedUnitSlug) && item.isOpen,
      ) ??
      units.find((item) => item.slug === selectedUnitSlug || item.id === selectedUnitSlug) ??
      deliveryUnit
    );
  }

  function copyPix(amount: number) {
    const code = `00020126360014BR.GOV.BCB.PIX0114maximus@pix.com.br5204000053039865406${amount
      .toFixed(2)
      .replace(".", "")}5802BR5907Maximus6009SAO PAULO62070503***6304ABCD`;
    if (!navigator.clipboard) {
      toast.error("Seu navegador não permite copiar o Pix automaticamente.");
      return;
    }
    navigator.clipboard
      .writeText(code)
      .then(() => toast.success("Código Pix copiado com o valor!"))
      .catch(() => toast.error("Não foi possível copiar o Pix."));
  }

  const currentOrderMode: OrderTrackMode =
    consumeMode === "delivery" && !isQrDineIn
      ? "delivery"
      : consumeMode === "mesa" || consumeMode === "local"
        ? "mesa"
        : "retirada";
  const deliveryQuote = calculateDeliveryQuote({
    subtotal,
    unit: resolveManualDeliveryUnit(),
    distanceKm: deliveryDistanceKm,
    rules: deliveryRules,
    neighborhood: address.bairro,
    locationSource: deliveryLocationSource,
  });
  const finalTotal = subtotal + (consumeMode === "delivery" ? (deliveryQuote.fee ?? 0) : 0);
  if (consumeMode === "delivery") {
    console.info("[Maximus][checkout][delivery-fee]", {
      endereco: {
        rua: address.rua,
        numero: address.numero,
        bairro: address.bairro,
      },
      bairro: address.bairro,
      unidadeAtribuida: deliveryQuoteUnitLabel(resolveManualDeliveryUnit()),
      coordenadas: deliveryLocation,
      metodo: deliveryQuote.method,
      geocodingStatus,
      taxa: deliveryQuote.fee,
      distanciaKm: deliveryQuote.distanceKm,
      bloqueio: deliveryQuote.blockedReason,
    });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader
        mesa={effectiveTable}
        unidade={effectiveUnit}
        mode={isQrDineIn ? "dine_in" : undefined}
      />
      <div className="mx-auto max-w-lg px-4 pt-6">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {count} {count === 1 ? "item" : "itens"} no pedido
          </span>
          <span className="font-bold text-primary">{formatPrice(subtotal)}</span>
        </div>
      </div>

      {/* ---------- MODE SELECTION ---------- */}
      {step === "mode" && (
        <CheckoutShell
          title="Como você quer receber seu pedido?"
          subtitle={
            isQrDineIn && effectiveTable
              ? `Pedido da Mesa ${normalizeTableNumber(effectiveTable)}`
              : "Revise se está tudo certo antes de continuar."
          }
        >
          <div className="space-y-3">
            {isQrDineIn && effectiveTable ? (
              <>
                <BigOption
                  label={`Comer na Mesa ${displayMesa}`}
                  description="Será servido diretamente na sua mesa."
                  onClick={() => {
                    setConsumeMode("mesa");
                    setTable(normalizeTableNumber(effectiveTable));
                    setStep("mesaConfirm");
                  }}
                />
                <BigOption
                  label="Pedir para levar"
                  description="Retire e leve seu pedido."
                  onClick={() => {
                    setConsumeMode("levar");
                    setStep("levar");
                  }}
                />
              </>
            ) : (
              <>
                <BigOption
                  label="Delivery"
                  description="Receba no seu endereço."
                  onClick={() => {
                    setConsumeMode("delivery");
                    setStep(hasSavedProfile && !editingProfile ? "location" : "contact");
                  }}
                />
                <BigOption
                  label="Retirar no balcão"
                  description="Retire na loja quando estiver pronto."
                  onClick={() => {
                    setConsumeMode("balcao");
                    setStep("balcao");
                  }}
                />
                <BigOption
                  label="Comer no local"
                  description="Escolha uma mesa livre."
                  onClick={() => {
                    setConsumeMode("local");
                    setStep("local");
                  }}
                />
              </>
            )}
          </div>
        </CheckoutShell>
      )}

      {/* ---------- QR: COMER NA MESA ---------- */}
      {step === "mesaConfirm" && (
        <CheckoutShell
          title={`Comer na Mesa ${displayMesa}`}
          subtitle={`Total: ${formatPrice(subtotal)}`}
          onBack={() => setStep("mode")}
        >
          <div className="space-y-4">
            <p className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-bold text-primary">
              Mesa {displayMesa} identificada
            </p>
            <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
            <Field
              label="Telefone (opcional)"
              value={phone}
              onChange={setPhone}
              type="tel"
              autoComplete="tel"
            />
            <ConsentCheckbox checked={privacyConsent} onCheckedChange={setPrivacyConsent} />
            <Button
              className="w-full bg-gradient-primary font-bold"
              size="lg"
              disabled={!name || !privacyConsent}
              onClick={() => setStep("payment")}
            >
              Continuar para pagamento
            </Button>
          </div>
        </CheckoutShell>
      )}

      {/* ---------- QR: LEVAR ---------- */}
      {step === "levar" && (
        <CheckoutShell title="Pedir para levar" onBack={() => setStep("mode")}>
          <div className="space-y-4">
            <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
            <Field
              label="Telefone"
              value={phone}
              onChange={setPhone}
              type="tel"
              autoComplete="tel"
            />
            <ConsentCheckbox checked={privacyConsent} onCheckedChange={setPrivacyConsent} />
            <Button
              className="w-full bg-gradient-primary font-bold"
              size="lg"
              disabled={!name || !phone || !privacyConsent}
              onClick={() => setStep("payment")}
            >
              Continuar para pagamento
            </Button>
          </div>
        </CheckoutShell>
      )}

      {/* ---------- BALCÃO ---------- */}
      {step === "balcao" && (
        <CheckoutShell title="Retirar no balcão" onBack={() => setStep("mode")}>
          <div className="space-y-4">
            <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
            <Field
              label="Telefone"
              value={phone}
              onChange={setPhone}
              type="tel"
              autoComplete="tel"
            />
            <ConsentCheckbox checked={privacyConsent} onCheckedChange={setPrivacyConsent} />
            <Button
              className="w-full bg-gradient-primary font-bold"
              size="lg"
              disabled={!name || !phone || !privacyConsent}
              onClick={() => setStep("payment")}
            >
              Continuar para pagamento
            </Button>
          </div>
        </CheckoutShell>
      )}

      {/* ---------- COMER NO LOCAL ---------- */}
      {step === "local" && (
        <CheckoutShell title="Comer no local" onBack={() => setStep("mode")}>
          <div className="space-y-4">
            <TableGrid
              tables={unitTables}
              selectedTable={table}
              onSelect={(selected) => setTable(selected.tableNumber)}
            />
            <Button
              className="w-full bg-gradient-primary font-bold"
              size="lg"
              disabled={!table.trim()}
              onClick={() => setStep("payment")}
            >
              Continuar para pagamento
            </Button>
          </div>
        </CheckoutShell>
      )}

      {/* ---------- DELIVERY: CONTACT ---------- */}
      {step === "contact" && (
        <CheckoutShell
          title="Seus dados"
          subtitle="Para entrega (Delivery)"
          onBack={() => setStep("mode")}
        >
          <div className="space-y-4">
            {hasSavedProfile && !editingProfile ? (
              <CustomerProfileCard
                name={name}
                phone={phone}
                onContinue={async () => {
                  await persistCustomer();
                  setStep("location");
                }}
                onChange={() => {
                  setEditingProfile(true);
                  setPrivacyConsent(false);
                }}
              />
            ) : (
              <>
                <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
                <Field
                  label="Telefone"
                  value={phone}
                  onChange={setPhone}
                  type="tel"
                  autoComplete="tel"
                />
                <Field
                  label="E-mail (opcional)"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  autoComplete="email"
                />
                <ConsentCheckbox checked={privacyConsent} onCheckedChange={setPrivacyConsent} />
              </>
            )}
            {(!hasSavedProfile || editingProfile) && (
              <Button
                className="w-full bg-gradient-primary font-bold"
                size="lg"
                disabled={!name || !phone || (!hasSavedProfile && !privacyConsent)}
                onClick={async () => {
                  await persistCustomer();
                  setEditingProfile(false);
                  setStep("location");
                }}
              >
                Continuar
              </Button>
            )}
          </div>
        </CheckoutShell>
      )}

      {/* ---------- DELIVERY: LOCATION PERMISSION ---------- */}
      {step === "location" && (
        <CheckoutShell title="Endereço de entrega" onBack={() => setStep("contact")}>
          {currentCustomer?.addresses.length ? (
            <SavedAddresses
              addresses={currentCustomer.addresses}
              selectedAddressId={selectedAddressId}
              onSelect={(saved) => {
                setSelectedAddressId(saved.id);
                setEditingAddressId(null);
                fillAddress(saved);
                applySavedAddressLocation(saved);
              }}
              onEdit={(saved) => {
                setSelectedAddressId(saved.id);
                setEditingAddressId(saved.id);
                fillAddress(saved);
                applySavedAddressLocation(saved);
                setStep("addressManual");
              }}
              onDelete={async (id) => {
                try {
                  if (!currentCustomer) return;
                  const next = await deleteAddress(currentCustomer.id, id);
                  setCurrentCustomer(next);
                  if (selectedAddressId === id) {
                    setSelectedAddressId("");
                    setAddress(EMPTY_ADDRESS);
                    setDeliveryLocation(null);
                    setDeliveryDistanceKm(null);
                    setDeliveryRangeId(null);
                  }
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Não foi possível excluir o endereço.",
                  );
                }
              }}
              onDefault={async (id) => {
                try {
                  if (!currentCustomer) return;
                  setCurrentCustomer(await setDefaultAddress(currentCustomer.id, id));
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Não foi possível definir o endereço principal.",
                  );
                }
              }}
              onNew={() => {
                setSelectedAddressId("");
                setEditingAddressId(null);
                setAddress(EMPTY_ADDRESS);
                setDeliveryLocation(null);
                setDeliveryDistanceKm(null);
                setDeliveryRangeId(null);
                setSaveAsDefault(currentCustomer.addresses.length === 0);
                setStep("addressManual");
              }}
            />
          ) : (
            <p className="mb-4 text-muted-foreground">
              Preencha o endereço para calcular a entrega. A localização atual é opcional.
            </p>
          )}
          <div className="space-y-3">
            {selectedAddressId && isAddressComplete && (
              <DeliveryLocationSummary
                address={address}
                deliveryUnit={resolveManualDeliveryUnit()}
                deliveryDistanceKm={deliveryDistanceKm}
                deliveryQuote={deliveryQuote}
                subtotal={subtotal}
                showBlockedReason={isAddressComplete}
              />
            )}
            {selectedAddressId && isAddressComplete && (
              <Button
                className="w-full bg-gradient-primary font-bold"
                size="lg"
                disabled={subtotal < deliveryQuote.minimumOrderValue}
                onClick={async () => {
                  const resolved = await resolveManualAddressLocation();
                  const nextUnit = resolved?.unit ?? resolveManualDeliveryUnit();
                  const nextDistanceKm = resolved?.distanceKm ?? deliveryDistanceKm;
                  const nextRules = await loadRulesForResolvedUnit(nextUnit);
                  const nextQuote = calculateDeliveryQuote({
                    subtotal,
                    unit: nextUnit,
                    distanceKm: nextDistanceKm,
                    rules: nextRules,
                    neighborhood: address.bairro,
                    locationSource: resolved?.locationSource ?? deliveryLocationSource,
                  });
                  if (nextQuote.fee == null) {
                    setGeocodingStatus(resolved?.geocodingStatus ?? "not_needed");
                    toast.error(nextQuote.blockedReason ?? "Não foi possível calcular a entrega.");
                    return;
                  }
                  setStep("payment");
                }}
              >
                Entregar neste endereço
              </Button>
            )}
            <Button
              className="w-full bg-gradient-primary font-bold"
              size="lg"
              disabled={locating}
              onClick={() => {
                setDeliveryAddressMode("gps");
                requestGeolocation();
              }}
            >
              <MapPin className="mr-2 h-4 w-4" />{" "}
              {locating ? "Solicitando localização..." : "Usar minha localização atual"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => {
                setDeliveryAddressMode("other");
                setPendingDelivery(null);
                setDeliveryLocation(null);
                setDeliveryDistanceKm(null);
                setDeliveryRangeId(null);
                setDeliveryUnit(null);
                setStep("addressManual");
              }}
            >
              Entregar em outro endereço
            </Button>
          </div>
        </CheckoutShell>
      )}

      {/* ---------- DELIVERY: ADDRESS MANUAL ---------- */}
      {step === "addressManual" && (
        <CheckoutShell title="Endereço de entrega" onBack={() => setStep("location")}>
          <div className="space-y-4">
            {locationConfirmed && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                <p className="font-bold">
                  {deliveryUnit
                    ? `Pedido direcionado para a unidade mais próxima: ${deliveryUnit.name}.`
                    : "Localização encontrada. Complete o endereço para validar a entrega."}
                </p>
              </div>
            )}
            {locationDenied && (
              <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                Não conseguimos acessar sua localização. Preencha o endereço como referência e
                marque o local no mapa.
              </p>
            )}
            {noOpenUnits && (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                No momento não há unidade disponível para delivery.
              </p>
            )}
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold">Endereço de entrega</h3>
                  <p className="text-xs text-muted-foreground">
                    Confirme o local da entrega pelo GPS ou marque no mapa.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeliveryAddressMode("gps");
                    setPendingDelivery(null);
                    requestGeolocation();
                  }}
                  disabled={locating}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  {locating ? "Localizando..." : "Usar minha localização atual"}
                </Button>
              </div>
              {deliveryLocation ? (
                <DeliveryLocationSummary
                  address={address}
                  deliveryUnit={resolveManualDeliveryUnit()}
                  deliveryDistanceKm={deliveryDistanceKm}
                  deliveryQuote={deliveryQuote}
                  subtotal={subtotal}
                  showBlockedReason={isAddressComplete}
                />
              ) : (
                <p className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                  Confirme o local da entrega pelo GPS ou marque no mapa. O endereço escrito fica
                  como referência do pedido.
                </p>
              )}
            </section>
            {currentCustomer?.addresses.length ? (
              <SavedAddresses
                addresses={currentCustomer.addresses}
                selectedAddressId={selectedAddressId}
                onSelect={(saved) => {
                  setSelectedAddressId(saved.id);
                  setEditingAddressId(null);
                  fillAddress(saved);
                  applySavedAddressLocation(saved);
                }}
                onEdit={(saved) => {
                  setSelectedAddressId(saved.id);
                  setEditingAddressId(saved.id);
                  fillAddress(saved);
                }}
                onDelete={async (id) => {
                  try {
                    if (!currentCustomer) return;
                    const next = await deleteAddress(currentCustomer.id, id);
                    setCurrentCustomer(next);
                    if (selectedAddressId === id) {
                      setSelectedAddressId("");
                      setAddress(EMPTY_ADDRESS);
                      setDeliveryLocation(null);
                      setDeliveryDistanceKm(null);
                      setDeliveryRangeId(null);
                    }
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível excluir o endereço.",
                    );
                  }
                }}
                onDefault={async (id) => {
                  try {
                    if (!currentCustomer) return;
                    setCurrentCustomer(await setDefaultAddress(currentCustomer.id, id));
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível definir o endereço principal.",
                    );
                  }
                }}
                onNew={() => {
                  if (currentCustomer.addresses.length >= 5) {
                    toast.error(
                      "Você pode salvar até 5 endereços. Remova um endereço antigo para adicionar outro.",
                    );
                    return;
                  }
                  setSelectedAddressId("");
                  setEditingAddressId(null);
                  setAddress(EMPTY_ADDRESS);
                  setDeliveryLocation(null);
                  setDeliveryDistanceKm(null);
                  setDeliveryRangeId(null);
                  setSaveAsDefault(currentCustomer.addresses.length === 0);
                }}
              />
            ) : null}
            <div>
              <Label className="mb-2 block">Apelido</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["Casa", "Trabalho", "Outro"] as const).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setAddress({ ...address, label })}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                      address.label === label
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label="Rua"
              value={address.rua}
              onChange={(v) => setAddress({ ...address, rua: v })}
              autoComplete="address-line1"
            />
            <Field
              label="Número"
              value={address.numero}
              onChange={(v) => setAddress({ ...address, numero: v })}
              inputMode="numeric"
            />
            <Field
              label="Bairro"
              value={address.bairro}
              onChange={(v) => setAddress({ ...address, bairro: v })}
              autoComplete="address-level3"
            />
            <Field
              label="CEP (opcional)"
              value={address.cep}
              onChange={(v) => setAddress({ ...address, cep: v })}
              inputMode="numeric"
              autoComplete="postal-code"
            />
            <Field
              label="Complemento"
              value={address.complemento}
              onChange={(v) => setAddress({ ...address, complemento: v })}
              autoComplete="address-line2"
            />
            <Field
              label="Ponto de referência"
              value={address.referencia}
              onChange={(v) => setAddress({ ...address, referencia: v })}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={saveAsDefault}
                onCheckedChange={(checked) => setSaveAsDefault(Boolean(checked))}
              />
              Definir como endereço principal
            </label>
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3">
                <h3 className="font-extrabold">Local no mapa</h3>
                <p className="text-xs text-muted-foreground">
                  Toque no mapa para marcar o ponto real da entrega.
                </p>
              </div>
              <LocationPickerMap
                value={deliveryLocation}
                fallback={
                  deliveryLocation ??
                  (deliveryUnit
                    ? { latitude: deliveryUnit.latitude, longitude: deliveryUnit.longitude }
                    : units[0]
                      ? { latitude: units[0].latitude, longitude: units[0].longitude }
                      : undefined)
                }
                className="h-72 rounded-xl"
                onChange={(point) => {
                  setDeliveryAddressMode("other");
                  setPendingDelivery(null);
                  applyDeliveryLocation(point, "manual_pin")
                    .then((nearest) => {
                      if (nearest) toast.success("Local da entrega marcado.");
                    })
                    .catch((error) => {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Não foi possível calcular a entrega.",
                      );
                    });
                }}
              />
            </section>
            {isAddressComplete && deliveryQuote.blockedReason ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600">
                {deliveryQuote.blockedReason}
              </p>
            ) : null}
            {pendingDelivery?.location && (
              <section className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm">
                <h3 className="font-extrabold text-primary">Entrega calculada</h3>
                <p className="mt-2 font-semibold">
                  {pendingDelivery.displayAddress ||
                    formatManualAddress({
                      street: address.rua,
                      number: address.numero,
                      neighborhood: address.bairro,
                      city: "Santarém",
                      state: "PA",
                      postalCode: address.cep,
                    })}
                </p>
                <div className="mt-3 space-y-1 text-xs font-semibold text-muted-foreground">
                  <p>Bairro: {address.bairro}</p>
                  <p>Cidade: Santarém - PA</p>
                  <p>Unidade responsável: {pendingDelivery.unit?.name ?? "A definir"}</p>
                  <p>
                    Distância aproximada:{" "}
                    {pendingDelivery.distanceKm != null
                      ? `${pendingDelivery.distanceKm.toFixed(1)} km`
                      : "não calculada"}
                  </p>
                  <p>
                    Taxa de entrega:{" "}
                    {calculateDeliveryQuote({
                      subtotal,
                      unit: pendingDelivery.unit,
                      distanceKm: pendingDelivery.distanceKm,
                      rules:
                        pendingDelivery.unit?.id === deliveryUnit?.id && deliveryRules.length
                          ? deliveryRules
                          : [],
                      neighborhood: address.bairro,
                      locationSource: pendingDelivery.locationSource,
                    }).fee == null
                      ? "não calculada"
                      : formatPrice(
                          calculateDeliveryQuote({
                            subtotal,
                            unit: pendingDelivery.unit,
                            distanceKm: pendingDelivery.distanceKm,
                            rules:
                              pendingDelivery.unit?.id === deliveryUnit?.id && deliveryRules.length
                                ? deliveryRules
                                : [],
                            neighborhood: address.bairro,
                            locationSource: pendingDelivery.locationSource,
                          }).fee ?? 0,
                        )}
                  </p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    className="bg-gradient-primary font-bold"
                    onClick={async () => {
                      const customer = await persistCustomer();
                      if (!customer) return;
                      const rules = await loadRulesForResolvedUnit(pendingDelivery.unit);
                      const quote = calculateDeliveryQuote({
                        subtotal,
                        unit: pendingDelivery.unit,
                        distanceKm: pendingDelivery.distanceKm,
                        rules,
                        neighborhood: address.bairro,
                        locationSource: pendingDelivery.locationSource,
                      });
                      if (quote.fee == null) {
                        toast.error(quote.blockedReason ?? "Não foi possível calcular a entrega.");
                        return;
                      }
                      if (!selectedAddressId || editingAddressId) {
                        await saveCurrentAddress(customer.id, pendingDelivery.location);
                      }
                      setStep("payment");
                    }}
                  >
                    Confirmar local
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setPendingDelivery(null)}>
                    Corrigir endereço
                  </Button>
                </div>
              </section>
            )}
            <Button
              className="w-full bg-gradient-primary font-bold"
              size="lg"
              disabled={
                noOpenUnits ||
                subtotal < deliveryQuote.minimumOrderValue ||
                !deliveryLocation ||
                !address.rua.trim() ||
                !address.numero.trim() ||
                !address.bairro.trim()
              }
              onClick={async () => {
                setDeliveryAddressMode("other");
                const resolved = await resolveManualAddressLocation();
                if (!resolved?.location) {
                  toast.error("Confirme o local da entrega pelo GPS ou marque no mapa.");
                  return;
                }
                const nextUnit = resolved.unit;
                const nextDistanceKm = resolved.distanceKm;
                const nextRules = await loadRulesForResolvedUnit(nextUnit);
                const nextQuote = calculateDeliveryQuote({
                  subtotal,
                  unit: nextUnit,
                  distanceKm: nextDistanceKm,
                  rules: nextRules,
                  neighborhood: address.bairro,
                  locationSource: resolved.locationSource,
                });
                if (nextQuote.fee == null) {
                  toast.error(nextQuote.blockedReason ?? "Não foi possível calcular a entrega.");
                  return;
                }
              }}
            >
              Calcular entrega
            </Button>
          </div>
        </CheckoutShell>
      )}

      {/* ---------- PAYMENT: METHOD ---------- */}
      {step === "payment" && (
        <CheckoutShell
          title="Como você quer pagar?"
          subtitle={`Total: ${formatPrice(finalTotal)}`}
          onBack={() => {
            if (consumeMode === "delivery") setStep("addressManual");
            else if (consumeMode === "balcao") setStep("balcao");
            else if (consumeMode === "levar") setStep("levar");
            else if (consumeMode === "mesa") setStep("mesaConfirm");
            else if (consumeMode === "local") setStep("local");
            else setStep("mode");
          }}
        >
          <div className="space-y-3">
            <BigOption
              label={
                consumeMode === "delivery"
                  ? "Pagar na entrega"
                  : consumeMode === "mesa" || consumeMode === "local"
                    ? "Pagar no local"
                    : "Pagar na retirada"
              }
              description={
                consumeMode === "delivery"
                  ? "Dinheiro, cartão ou Pix ao receber."
                  : consumeMode === "mesa" || consumeMode === "local"
                    ? "Dinheiro, cartão ou Pix no atendimento."
                    : "Dinheiro, cartão ou Pix ao retirar."
              }
              onClick={() => setStep("payDelivery")}
            />
            <BigOption
              label="Pagar pelo app"
              description="Pague agora via Pix."
              onClick={() => setStep("payApp")}
            />
          </div>
        </CheckoutShell>
      )}

      {/* ---------- PAYMENT: ON DELIVERY METHOD ---------- */}
      {step === "payDelivery" && (
        <CheckoutShell title="Escolha a forma de pagamento" onBack={() => setStep("payment")}>
          <div className="space-y-3">
            <BigOption label="Dinheiro" onClick={() => setStep("payCash")} />
            <BigOption label="Cartão" onClick={() => setStep("payCard")} />
            <BigOption label="Pix" onClick={() => setStep("payPixDelivery")} />
          </div>
        </CheckoutShell>
      )}

      {/* ---------- PAYMENT: CASH ---------- */}
      {step === "payCash" && (
        <CheckoutShell title="Pagamento em dinheiro" onBack={() => setStep("payDelivery")}>
          <CheckoutReviewSummary
            customerName={name}
            customerPhone={phone}
            address={consumeMode === "delivery" ? address : null}
            paymentLabel="Dinheiro"
            subtotal={subtotal}
            deliveryFee={consumeMode === "delivery" ? deliveryQuote.fee : 0}
            total={finalTotal}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={needChange} onCheckedChange={(c) => setNeedChange(!!c)} />
            Preciso de troco
          </label>
          {needChange && (
            <div className="mt-4">
              <Field
                label="Troco para quanto?"
                value={changeFor}
                onChange={setChangeFor}
                type="number"
              />
            </div>
          )}
          <Button
            className="mt-6 w-full bg-gradient-primary font-bold"
            size="lg"
            disabled={needChange && (!changeFor || Number(changeFor) <= subtotal)}
            onClick={() =>
              finalize(currentOrderMode, {
                ...(currentOrderMode === "mesa" ? { table: displayMesa } : {}),
                paymentStatus: "pending_on_delivery",
                paymentMethod: "dinheiro",
              })
            }
          >
            Confirmar pedido
          </Button>
        </CheckoutShell>
      )}

      {/* ---------- PAYMENT: CARD ---------- */}
      {step === "payCard" && (
        <CheckoutShell
          title="Pagamento no cartão"
          subtitle="Selecione o tipo"
          onBack={() => setStep("payDelivery")}
        >
          <div className="space-y-3">
            <CheckoutReviewSummary
              customerName={name}
              customerPhone={phone}
              address={consumeMode === "delivery" ? address : null}
              paymentLabel="Cartão"
              subtotal={subtotal}
              deliveryFee={consumeMode === "delivery" ? deliveryQuote.fee : 0}
              total={finalTotal}
            />
            <BigOption
              label="Crédito"
              onClick={() =>
                finalize(currentOrderMode, {
                  ...(currentOrderMode === "mesa" ? { table: displayMesa } : {}),
                  paymentStatus: "pending_on_delivery",
                  paymentMethod: "cartao",
                })
              }
            />
            <BigOption
              label="Débito"
              onClick={() =>
                finalize(currentOrderMode, {
                  ...(currentOrderMode === "mesa" ? { table: displayMesa } : {}),
                  paymentStatus: "pending_on_delivery",
                  paymentMethod: "cartao",
                })
              }
            />
          </div>
        </CheckoutShell>
      )}

      {/* ---------- PAYMENT: PIX ON DELIVERY ---------- */}
      {step === "payPixDelivery" && (
        <CheckoutShell title="Pix na entrega" onBack={() => setStep("payDelivery")}>
          <CheckoutReviewSummary
            customerName={name}
            customerPhone={phone}
            address={consumeMode === "delivery" ? address : null}
            paymentLabel="Pix na entrega"
            subtotal={subtotal}
            deliveryFee={consumeMode === "delivery" ? deliveryQuote.fee : 0}
            total={finalTotal}
          />
          <p className="text-muted-foreground">
            {consumeMode === "delivery"
              ? "O pagamento via Pix será feito ao entregador no momento da entrega."
              : consumeMode === "mesa" || consumeMode === "local"
                ? "O pagamento via Pix será feito no atendimento do local."
                : "O pagamento via Pix será feito no balcão no momento da retirada."}
          </p>
          <Button
            className="mt-6 w-full bg-gradient-primary font-bold"
            size="lg"
            onClick={() =>
              finalize(currentOrderMode, {
                ...(currentOrderMode === "mesa" ? { table: displayMesa } : {}),
                paymentStatus: "pending_on_delivery",
                paymentMethod: "pix_entrega",
              })
            }
          >
            Confirmar pedido
          </Button>
        </CheckoutShell>
      )}

      {/* ---------- PAYMENT: PIX APP ---------- */}
      {step === "payApp" && (
        <CheckoutShell title="Pagar pelo app (Pix)" onBack={() => setStep("payment")}>
          <CheckoutReviewSummary
            customerName={name}
            customerPhone={phone}
            address={consumeMode === "delivery" ? address : null}
            paymentLabel="Pix pelo app"
            subtotal={subtotal}
            deliveryFee={consumeMode === "delivery" ? deliveryQuote.fee : 0}
            total={finalTotal}
          />
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Chave Pix Maximus</p>
            <p className="font-bold">maximus@pix.com.br</p>
          </div>
          <Button
            variant="outline"
            className="mt-4 w-full"
            size="lg"
            onClick={() => copyPix(finalTotal)}
          >
            <Copy className="mr-2 h-4 w-4" /> Copiar Pix com valor
          </Button>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Copie o código Pix, cole no seu banco e avise a Maximus após enviar o pagamento.
          </p>
          <Button
            className="mt-6 w-full bg-gradient-primary font-bold"
            size="lg"
            onClick={() =>
              finalize(currentOrderMode, {
                ...(currentOrderMode === "mesa" ? { table: displayMesa } : {}),
                paymentStatus: "customer_reported_paid",
                paymentMethod: "pix_app",
              })
            }
          >
            <Check className="mr-2 h-4 w-4" /> Confirmar pedido
          </Button>
          <p className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            Seu pedido será enviado com pagamento aguardando confirmação da Maximus.
          </p>
        </CheckoutShell>
      )}
    </div>
  );
}

function TableGrid({
  tables,
  selectedTable,
  onSelect,
}: {
  tables: PublicTable[];
  selectedTable: string;
  onSelect: (table: PublicTable) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-400">
          Livre
        </span>
        <span className="rounded-full border border-border bg-secondary px-2.5 py-1">Ocupada</span>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 opacity-60">
          Indisponível
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {tables.map((table) => {
          const available = table.isActive && table.status === "livre";
          const selected = selectedTable === table.tableNumber;
          return (
            <button
              key={table.id}
              type="button"
              disabled={!available}
              onClick={() => onSelect(table)}
              className={`min-h-20 rounded-xl border p-3 text-left transition-colors ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : available
                    ? "border-emerald-500/30 bg-emerald-500/10 hover:border-primary hover:bg-primary/10"
                    : "cursor-not-allowed border-border bg-secondary/70 opacity-55"
              }`}
            >
              <p className="text-base font-black">Mesa {table.tableNumber}</p>
              <p className="mt-1 text-xs font-bold">
                {!table.isActive ? "Indisponível" : table.status === "livre" ? "Livre" : "Ocupada"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomerProfileCard({
  name,
  phone,
  onContinue,
  onChange,
}: {
  name: string;
  phone: string;
  onContinue: () => void;
  onChange: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">Você está pedindo como</p>
      <h3 className="mt-1 text-xl font-black">{name}</h3>
      <p className="mt-1 font-bold text-primary">{phone}</p>
      <Button className="mt-4 w-full bg-gradient-primary font-bold" size="lg" onClick={onContinue}>
        Continuar como este cliente
      </Button>
      <Button type="button" variant="ghost" className="mt-2 w-full" onClick={onChange}>
        Trocar dados
      </Button>
    </section>
  );
}

function DeliveryLocationSummary({
  address,
  deliveryUnit,
  deliveryDistanceKm,
  deliveryQuote,
  subtotal,
  showBlockedReason = true,
}: {
  address: typeof EMPTY_ADDRESS;
  deliveryUnit: GeoUnit | null;
  deliveryDistanceKm: number | null;
  deliveryQuote: DeliveryQuote;
  subtotal: number;
  showBlockedReason?: boolean;
}) {
  const addressText = [address.rua, address.numero].filter(Boolean).join(", ");
  const neighborhood = address.bairro ? ` - ${address.bairro}` : "";
  const completeAddress = Boolean(address.rua && address.numero && address.bairro);
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
      <p className="font-extrabold text-primary">
        {completeAddress ? "Localização confirmada" : "Localização encontrada"}
      </p>
      {addressText || neighborhood ? (
        <p className="mt-1 text-foreground">
          {addressText}
          {neighborhood}
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">Coordenada salva para calcular a rota.</p>
      )}
      <div className="mt-3 space-y-1 text-xs font-semibold text-muted-foreground">
        <p>Unidade: {deliveryUnit?.name ?? "A definir"}</p>
        <p>
          Distância aproximada:{" "}
          {deliveryDistanceKm != null
            ? `${deliveryDistanceKm.toFixed(1)} km`
            : "não calculada pelo GPS"}
        </p>
        <p>
          Taxa de entrega:{" "}
          {deliveryQuote.fee == null
            ? "a calcular"
            : deliveryQuote.isFree
              ? "grátis"
              : formatPrice(deliveryQuote.fee)}
        </p>
        <p>Total final: {formatPrice(subtotal + (deliveryQuote.fee ?? 0))}</p>
        {!completeAddress && (
          <p className="font-bold text-primary">Complete rua, número e bairro para confirmar.</p>
        )}
        {showBlockedReason && deliveryQuote.blockedReason ? (
          <p className="font-bold text-red-600">{deliveryQuote.blockedReason}</p>
        ) : null}
      </div>
    </div>
  );
}

function CheckoutReviewSummary({
  customerName,
  customerPhone,
  address,
  paymentLabel,
  subtotal,
  deliveryFee,
  total,
}: {
  customerName: string;
  customerPhone: string;
  address: typeof EMPTY_ADDRESS | null;
  paymentLabel: string;
  subtotal: number;
  deliveryFee: number | null;
  total: number;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-sm">
      <h3 className="font-extrabold">Confirmação do pedido</h3>
      <div className="mt-3 space-y-2">
        <SummaryRow label="Cliente" value={customerName || "Não informado"} />
        <SummaryRow label="Telefone" value={customerPhone || "Não informado"} />
        {address && (
          <SummaryRow
            label="Endereço"
            value={`${address.rua}, ${address.numero} - ${address.bairro}`}
          />
        )}
        <SummaryRow label="Subtotal" value={formatPrice(subtotal)} />
        {address && (
          <SummaryRow
            label="Entrega"
            value={deliveryFee == null ? "A calcular" : formatPrice(deliveryFee)}
          />
        )}
        <SummaryRow label="Total" value={formatPrice(total)} strong />
        <SummaryRow label="Pagamento" value={paymentLabel} />
      </div>
    </section>
  );
}

function SavedAddresses({
  addresses,
  selectedAddressId,
  onSelect,
  onEdit,
  onDelete,
  onDefault,
  onNew,
}: {
  addresses: CustomerAddress[];
  selectedAddressId: string;
  onSelect: (address: CustomerAddress) => void;
  onEdit: (address: CustomerAddress) => void;
  onDelete: (id: string) => void;
  onDefault: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold">Endereços salvos</h3>
          <p className="text-xs text-muted-foreground">Você pode salvar até 5 endereços.</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold"
        >
          Novo endereço
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {addresses.map((address) => (
          <div
            key={address.id}
            className={`rounded-xl border p-3 ${
              selectedAddressId === address.id
                ? "border-primary bg-primary/10"
                : "border-border bg-background"
            }`}
          >
            <button type="button" onClick={() => onSelect(address)} className="w-full text-left">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">
                  {address.label}
                  {address.isDefault ? " · Principal" : ""}
                </p>
                <span className="text-xs font-bold text-primary">Usar este endereço</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {address.street}, {address.number} · {address.neighborhood}
              </p>
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEdit(address)}
                className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold"
              >
                Editar
              </button>
              {!address.isDefault && (
                <button
                  type="button"
                  onClick={() => onDefault(address.id)}
                  className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold"
                >
                  Principal
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(address.id)}
                className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-black text-primary" : "font-bold"}>{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ConsentCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
      <span>
        Li e aceito os{" "}
        <a href="/termos" className="font-bold text-primary underline">
          Termos de uso
        </a>{" "}
        e a{" "}
        <a href="/privacidade" className="font-bold text-primary underline">
          Política de privacidade
        </a>
        .
      </span>
    </label>
  );
}

function calculateDeliveryQuote({
  subtotal,
  unit,
  distanceKm,
  rules,
  neighborhood,
  locationSource,
}: {
  subtotal: number;
  unit: GeoUnit | null;
  distanceKm: number | null;
  rules: DeliveryRuleQuote[];
  neighborhood: string;
  locationSource: DeliveryLocationSource;
}): DeliveryQuote {
  const minimumOrderValue = unit?.minimumOrderValue ?? 0;
  const maxDistanceKm = unit?.maxDeliveryDistanceKm ?? 0;

  if (!unit) {
    return {
      fee: null,
      distanceKm,
      deliveryRangeId: null,
      estimatedMinutes: null,
      minimumOrderValue,
      maxDistanceKm,
      isFree: false,
      method: "blocked",
      blockedReason:
        locationSource === "manual_unavailable"
          ? "Confirme o local da entrega pelo GPS ou marque no mapa."
          : "No momento não há unidade disponível para delivery.",
    };
  }

  if (!unit.isOpen) {
    return {
      fee: null,
      distanceKm,
      deliveryRangeId: null,
      estimatedMinutes: null,
      minimumOrderValue,
      maxDistanceKm,
      isFree: false,
      method: "blocked",
      blockedReason: "A unidade mais próxima está fechada no momento.",
    };
  }

  if (distanceKm != null && maxDistanceKm > 0 && distanceKm > maxDistanceKm) {
    return {
      fee: null,
      distanceKm,
      deliveryRangeId: null,
      estimatedMinutes: null,
      minimumOrderValue,
      maxDistanceKm,
      isFree: false,
      method: "blocked",
      blockedReason: "Este endereço está fora da área de entrega.",
    };
  }

  const freeDeliveryFrom = unit.freeDeliveryFrom ?? 0;
  const distanceMethod = locationSource === "gps" ? "gps" : "manual_pin";
  const activeRules = [...rules]
    .filter((rule) => rule.isActive !== false)
    .sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  const matchedRule =
    distanceKm == null ? null : activeRules.find((rule) => rule.maxDistanceKm >= distanceKm);

  if (distanceKm != null && activeRules.length > 0) {
    if (!matchedRule) {
      return {
        fee: null,
        distanceKm,
        deliveryRangeId: null,
        estimatedMinutes: null,
        minimumOrderValue,
        maxDistanceKm,
        isFree: false,
        method: "blocked",
        blockedReason: "Este endereço está fora da área de entrega.",
      };
    }

    return {
      fee: matchedRule.deliveryFee,
      distanceKm,
      deliveryRangeId: matchedRule.id,
      estimatedMinutes: matchedRule.estimatedMinutes,
      minimumOrderValue,
      maxDistanceKm,
      isFree: matchedRule.deliveryFee === 0,
      method: distanceMethod,
    };
  }

  if (distanceKm != null && freeDeliveryFrom > 0 && subtotal >= freeDeliveryFrom) {
    return {
      fee: 0,
      distanceKm,
      deliveryRangeId: null,
      estimatedMinutes: null,
      minimumOrderValue,
      maxDistanceKm,
      isFree: true,
      method: distanceMethod,
    };
  }

  if (distanceKm != null) {
    const baseFee = unit.baseDeliveryFee ?? 0;
    const perKm = unit.deliveryFeePerKm ?? 0;
    if (baseFee > 0 || perKm > 0) {
      return {
        fee: Number((baseFee + distanceKm * perKm).toFixed(2)),
        distanceKm,
        deliveryRangeId: null,
        estimatedMinutes: null,
        minimumOrderValue,
        maxDistanceKm,
        isFree: false,
        method: distanceMethod,
      };
    }
  }

  return {
    fee: null,
    distanceKm,
    deliveryRangeId: null,
    estimatedMinutes: null,
    minimumOrderValue,
    maxDistanceKm,
    isFree: false,
    method: "blocked",
    blockedReason: neighborhood.trim()
      ? "Confirme o local da entrega pelo GPS ou marque no mapa."
      : "Confirme o local da entrega pelo GPS ou marque no mapa.",
  };
}

function deliveryQuoteUnitLabel(unit: GeoUnit | null) {
  return unit ? `${unit.name} (${unit.id})` : null;
}
