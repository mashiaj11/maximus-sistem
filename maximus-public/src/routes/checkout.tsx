import { useEffect, useId, useMemo, useState, type HTMLAttributes } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Banknote,
  Check,
  Copy,
  CreditCard,
  LocateFixed,
  MapPinned,
  QrCode,
  Search,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { GoogleAddressMap } from "@/components/GoogleAddressMap";
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
  DeliveryZone,
  OrderInfo,
  OrderTrackMode,
} from "@/lib/types";
import { normalizeMesa } from "@/lib/utils";
import { type GeoUnit } from "@/lib/geo";
import { getDefaultSelections } from "@/lib/cart-customization";
import {
  formatManualAddress,
  normalizeNeighborhoodName,
  type GeocodingStatus,
} from "@/lib/geocoding";
import {
  geocodeAddress,
  getCurrentLocation,
  getGoogleMapsApiKey,
  reverseGeocodeLatLng,
  type NormalizedGoogleAddress,
} from "@/lib/google-maps";
import {
  deleteAddress,
  findCustomerByPhone,
  getCurrentCustomer,
  getSavedCustomerProfile,
  isCustomerConfirmedThisSession,
  normalizePhone,
  saveAddress,
  saveCustomer,
  saveSavedCustomerProfile,
  setDefaultAddress,
} from "@/lib/customer";
import {
  createOrderInSupabase,
  findPublicTable,
  loadActivePublicUnit,
  loadDeliveryRules,
  loadDeliveryZones,
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

const ADDRESS_LIMIT_MESSAGE =
  "Você já tem 3 endereços salvos. Escolha um endereço existente, edite ou exclua um para adicionar outro.";

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

const DELIVERY_CALCULATION_METHOD = "zone" as const;
const NO_ZONE_MESSAGE =
  "Não conseguimos identificar a região de entrega desse endereço. Ajuste o pino no mapa ou tente buscar o endereço novamente.";

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
  | "payCash"
  | "payCard"
  | "payPix"
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
  cidade: "Santarém",
  estado: "PA",
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
  estimatedMinutes: number | null;
  locationSource: DeliveryLocationSource;
  geocodingStatus: GeocodingStatus;
  displayAddress?: string;
};

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
  const { items, subtotal, count, orderContext, setOrderContext, addItem, clearItems } = useCart();
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

  const customerAlreadyConfirmed = isCustomerConfirmedThisSession();
  const [step, setStep] = useState<Step>(customerAlreadyConfirmed ? "mode" : "contact");
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
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [resolvedDeliveryZoneId, setResolvedDeliveryZoneId] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [addressMode, setAddressMode] = useState<"start" | "form">("start");
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState("");
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
  const [, setGpsAuthorized] = useState(false);
  const [noOpenUnits, setNoOpenUnits] = useState(false);
  const [needChange, setNeedChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);

  const requestedActiveUnit = useMemo(() => {
    if (!effectiveUnit || !units.length) return null;
    return units.find((item) => item.slug === effectiveUnit || item.id === effectiveUnit) ?? null;
  }, [effectiveUnit, units]);
  const activeUnit = useMemo(() => {
    if (!units.length) return null;
    return requestedActiveUnit ?? units[0];
  }, [requestedActiveUnit, units]);
  const selectedDeliveryZone = useMemo(
    () => deliveryZones.find((zone) => zone.id === resolvedDeliveryZoneId) ?? null,
    [deliveryZones, resolvedDeliveryZoneId],
  );
  const qrUnitIsActive = !effectiveUnit || units.length === 0 || Boolean(requestedActiveUnit);
  const activeIsQrDineIn = isQrDineIn && qrUnitIsActive;

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
      setStep(customerAlreadyConfirmed ? "mode" : "contact");
    }
  }, [
    consumeMode,
    customerAlreadyConfirmed,
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
        setPhone(customer?.phone ?? phone);
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
    loadPublicMenu(selectedUnitSlug, activeIsQrDineIn ? "dine_in" : "delivery")
      .then((data) => {
        setUnits(data.units);
        const contextUnit =
          (selectedUnitSlug
            ? data.units.find(
                (unit) => unit.slug === selectedUnitSlug || unit.id === selectedUnitSlug,
              )
            : null) ??
          data.units[0] ??
          null;
        setDeliveryUnit(contextUnit);
      })
      .catch(() => undefined);
  }, [activeIsQrDineIn, selectedUnitSlug]);

  useEffect(() => {
    const unitForTables = activeUnit?.slug ?? activeUnit?.id;
    if (!unitForTables) {
      setUnitTables([]);
      return;
    }
    loadPublicTables(unitForTables)
      .then(setUnitTables)
      .catch(() => setUnitTables([]));
  }, [activeUnit?.id, activeUnit?.slug]);

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
    const unitId = activeUnit?.id ?? deliveryUnit?.id;
    if (!unitId) {
      setDeliveryZones([]);
      setResolvedDeliveryZoneId("");
      return;
    }
    loadDeliveryZones(unitId)
      .then((zones) => {
        setDeliveryZones(zones);
        setResolvedDeliveryZoneId((current) =>
          current && zones.some((zone) => zone.id === current) ? current : "",
        );
      })
      .catch(() => {
        setDeliveryZones([]);
        setResolvedDeliveryZoneId("");
      });
  }, [activeUnit?.id, deliveryUnit?.id]);

  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || name.trim().length < 2 || currentCustomer?.phone === digits) return;

    const timeout = window.setTimeout(() => {
      findCustomerByPhone(phone, name)
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
  }, [currentCustomer?.phone, name, phone]);

  useEffect(() => {
    if (resolvedDeliveryZoneId || !deliveryZones.length) return;
    const zone = matchDeliveryZone(address.bairro, address.rua, address.cidade, detectedAddress);
    if (zone) setResolvedDeliveryZoneId(zone.id);
  }, [
    address.bairro,
    address.cidade,
    address.rua,
    deliveryZones,
    detectedAddress,
    resolvedDeliveryZoneId,
  ]);

  const isAddressComplete =
    Boolean(address.rua.trim()) && Boolean(address.numero.trim()) && Boolean(selectedDeliveryZone);
  const allUnitsClosed = units.length > 0 && units.every((unit) => !unit.isOpen);
  const googleMapsEnabled = Boolean(getGoogleMapsApiKey());

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <SiteHeader
          mesa={effectiveTable}
          unidade={effectiveUnit}
          mode={activeIsQrDineIn ? "dine_in" : undefined}
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
                  ...(activeIsQrDineIn ? { mode: "dine_in" } : {}),
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
          mode={activeIsQrDineIn ? "dine_in" : undefined}
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
      name: customer?.name ?? name,
      phone: customer?.phone ?? phone,
      customer_id: customer?.id,
      last_address_id: selectedAddressId || customer.addresses.find((item) => item.isDefault)?.id,
    });
    return customer;
  }

  async function hydrateCustomerFromFields() {
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 10 || name.trim().length < 2) return currentCustomer;
    if (currentCustomer?.phone === cleanPhone && currentCustomer.addresses.length > 0) {
      return currentCustomer;
    }
    setCustomerLookupLoading(true);
    try {
      const customer = await findCustomerByPhone(cleanPhone, name);
      if (!customer) return currentCustomer;
      setCurrentCustomer(customer);
      setHasSavedProfile(true);
      setName((current) => current || customer.name);
      setPhone(customer?.phone ?? phone);
      const defaultAddress =
        customer.addresses.find((item) => item.id === selectedAddressId) ??
        customer.addresses.find((item) => item.isDefault) ??
        customer.addresses[0];
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
        fillAddress(defaultAddress);
        applySavedAddressLocation(defaultAddress);
      }
      return customer;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel buscar seus enderecos salvos.",
      );
      return currentCustomer;
    } finally {
      setCustomerLookupLoading(false);
    }
  }

  function currentAddressDraft(
    location = deliveryLocation,
    zone = selectedDeliveryZone,
  ): Omit<CustomerAddress, "id" | "createdAt" | "updatedAt"> {
    return {
      label: address.label,
      street: address.rua.trim(),
      number: address.numero.trim(),
      neighborhood: address.bairro.trim(),
      city: address.cidade.trim() || "Santarém",
      state: address.estado.trim() || "PA",
      postalCode: address.cep.trim() || undefined,
      complement: address.complemento.trim() || undefined,
      reference: address.referencia.trim() || undefined,
      isDefault: saveAsDefault,
      latitude: location?.latitude,
      longitude: location?.longitude,
      deliveryZoneId: zone?.id,
      deliveryZoneName: zone?.name,
      deliveryFeeSnapshot: zone?.fee,
    };
  }

  function fillAddress(saved: CustomerAddress) {
    setAddress({
      label: saved.label,
      rua: saved.street,
      numero: saved.number,
      bairro: saved.neighborhood,
      cidade: saved.city ?? "Santarém",
      estado: saved.state ?? "PA",
      cep: saved.postalCode ?? "",
      complemento: saved.complement ?? "",
      referencia: saved.reference ?? "",
    });
    setResolvedDeliveryZoneId(saved.deliveryZoneId ?? "");
    setSaveAsDefault(saved.isDefault);
  }

  function applySavedAddressLocation(saved: CustomerAddress) {
    setDeliveryAddressMode("other");
    if (saved.deliveryZoneId) setResolvedDeliveryZoneId(saved.deliveryZoneId);
    if (saved.latitude == null || saved.longitude == null) return;
    setDeliveryLocation({ latitude: saved.latitude, longitude: saved.longitude });
  }

  function findSimilarSavedAddress() {
    const savedAddresses = currentCustomer?.addresses ?? [];
    const draftStreet = normalizeNeighborhoodName(address.rua);
    const draftNumber = address.numero.trim().toLowerCase();
    const draftNeighborhood = normalizeNeighborhoodName(address.bairro);
    if (!draftStreet || !draftNumber || !draftNeighborhood) return null;
    return (
      savedAddresses.find(
        (saved) =>
          normalizeNeighborhoodName(saved.street) === draftStreet &&
          saved.number.trim().toLowerCase() === draftNumber &&
          normalizeNeighborhoodName(saved.neighborhood) === draftNeighborhood,
      ) ?? null
    );
  }

  async function saveCurrentAddress(
    customerId: string,
    location = deliveryLocation,
    zone = selectedDeliveryZone,
  ) {
    const saved = await saveAddress(customerId, {
      ...currentAddressDraft(location, zone),
      id: (editingAddressId ?? selectedAddressId) || undefined,
    });
    setCurrentCustomer(saved);
    const savedAddressId = editingAddressId ?? selectedAddressId;
    const latest =
      saved.addresses.find((item) => item.id === savedAddressId) ?? saved.addresses.at(-1);
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

  function matchDeliveryZone(...values: Array<string | undefined | null>) {
    const candidates = values
      .flatMap((value) => (value ?? "").split(/[,\-·]/))
      .map(normalizeNeighborhoodName)
      .filter(Boolean);
    if (!candidates.length) return null;
    return (
      deliveryZones.find((zone) =>
        candidates.some((candidate) => normalizeNeighborhoodName(zone.name) === candidate),
      ) ??
      deliveryZones.find((zone) =>
        candidates.some((candidate) => normalizeNeighborhoodName(zone.name).includes(candidate)),
      ) ??
      deliveryZones.find((zone) =>
        candidates.some((candidate) => candidate.includes(normalizeNeighborhoodName(zone.name))),
      ) ??
      null
    );
  }

  function resolveZoneFromCurrentAddress() {
    return matchDeliveryZone(
      address.bairro,
      address.rua,
      address.cidade,
      detectedAddress,
      addressSearch,
    );
  }

  function applyGoogleAddress(result: NormalizedGoogleAddress | null) {
    if (!result) {
      toast.error("Endereço não encontrado. Você pode preencher manualmente.");
      setAddressMode("form");
      return;
    }
    setDetectedAddress(result.formattedAddress);
    setAddress((current) => ({
      ...current,
      rua: result.street || current.rua,
      numero: result.number || current.numero,
      bairro: result.neighborhood || current.bairro,
      cidade: result.city || current.cidade || "Santarém",
      estado: result.state || current.estado || "PA",
      cep: result.postalCode || current.cep,
    }));
    const zone = matchDeliveryZone(
      result.neighborhood,
      ...result.areaCandidates,
      result.formattedAddress,
      result.city,
      result.state,
    );
    setResolvedDeliveryZoneId(zone?.id ?? "");
    setDeliveryLocation({ latitude: result.latitude, longitude: result.longitude });
    setDeliveryLocationSource("manual_pin");
    setGeocodingStatus("geocoded");
    setLocationConfirmed(true);
    setLocationDenied(false);
    setAddressMode("form");
  }

  async function searchGoogleAddress() {
    if (!addressSearch.trim()) {
      toast.error("Digite um endereço ou CEP para buscar.");
      return;
    }
    setAddressLookupLoading(true);
    try {
      applyGoogleAddress(await geocodeAddress(addressSearch));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível buscar o endereço. Preencha manualmente.",
      );
      setAddressMode("form");
    } finally {
      setAddressLookupLoading(false);
    }
  }

  async function useBrowserLocation() {
    setAddressLookupLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await reverseGeocodeLatLng(location.latitude, location.longitude);
      applyGoogleAddress(
        result ?? {
          formattedAddress: "",
          street: "",
          number: "",
          neighborhood: "",
          areaCandidates: [],
          city: "Santarém",
          state: "PA",
          postalCode: "",
          latitude: location.latitude,
          longitude: location.longitude,
        },
      );
      setDeliveryLocationSource("gps");
      setGeocodingStatus("gps_confirmed");
    } catch (error) {
      setLocationDenied(true);
      setAddressMode("form");
      toast.error(
        error instanceof Error
          ? error.message
          : "Não conseguimos acessar sua localização. Você pode buscar pelo endereço ou preencher manualmente.",
      );
    } finally {
      setAddressLookupLoading(false);
    }
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
    if (activeIsQrDineIn && mode === "delivery") {
      toast.error("Delivery não está disponível para pedidos iniciados por QR de mesa.");
      setConsumeMode(null);
      setStep("mode");
      return;
    }
    setSubmitting(true);
    let resolvedDelivery: ResolvedDelivery | null = null;
    if (mode === "delivery") {
      if (!isAddressComplete) {
        toast.error(
          !selectedDeliveryZone ? NO_ZONE_MESSAGE : "Preencha rua e número para entrega.",
        );
        setSubmitting(false);
        return;
      }
      resolvedDelivery = {
        location: deliveryLocation,
        unit: activeUnit ?? deliveryUnit,
        distanceKm: null,
        deliveryRangeId: null,
        estimatedMinutes: deliveryQuote.estimatedMinutes,
        locationSource: "manual_unavailable",
        geocodingStatus: "not_needed",
      };
    }
    const unit =
      mode === "delivery"
        ? (resolvedDelivery?.unit ?? activeUnit ?? (await loadActivePublicUnit(selectedUnitSlug)))
        : (activeUnit ?? (await loadActivePublicUnit(selectedUnitSlug)));
    const customer = await persistCustomer();
    let usedAddress: CustomerAddress | undefined;
    let tableId: string | null = null;
    if (mode === "delivery" && customer) {
      try {
        const customerAddresses = customer.addresses ?? currentCustomer?.addresses ?? [];
        usedAddress = selectedAddressId
          ? customerAddresses.find((item) => item.id === selectedAddressId)
          : undefined;
        if (!usedAddress) {
          const now = Date.now();
          usedAddress = {
            ...currentAddressDraft(resolvedDelivery?.location ?? null, selectedDeliveryZone),
            id: "",
            createdAt: now,
            updatedAt: now,
          };
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
      toast.error("Não conseguimos carregar a loja agora. Atualize a página e tente novamente.");
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
            deliveryZone: selectedDeliveryZone,
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
        zonaEntrega: selectedDeliveryZone?.name,
        taxaCalculada: deliveryFee,
        metodo: quote?.method,
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
      deliveryDistanceKm: null,
      deliveryFee,
      deliveryRangeId: null,
      deliveryZoneId: selectedDeliveryZone?.id ?? null,
      deliveryZoneName: selectedDeliveryZone?.name ?? null,
      deliveryEstimatedTime:
        mode === "delivery"
          ? (resolvedDelivery?.estimatedMinutes ?? quote?.estimatedMinutes ?? null)
          : null,
      deliveryCalculationMethod: mode === "delivery" ? DELIVERY_CALCULATION_METHOD : null,
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
        addressId: selectedAddressId ? usedAddress?.id : undefined,
        unitId: unit.id,
        tableId,
        deliveryFee,
        deliveryDistanceKm: null,
        deliveryRangeId: null,
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
          name: customer?.name ?? name,
          phone: customer?.phone ?? phone,
          customer_id: customer?.id,
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
        let resolved: ResolvedDelivery | null = null;
        try {
          resolved = await applyDeliveryLocation(location, "gps");
        } catch (error) {
          setLocating(false);
          toast.error(error instanceof Error ? error.message : "Não foi possível calcular a rota.");
          return;
        }
        setLocating(false);
        if (resolved?.distanceKm != null && resolved.deliveryRangeId) {
          toast.success("Entrega calculada. Complete o endereço.");
        } else {
          toast.info("Localização capturada. Complete o endereço manualmente.");
        }
        const gpsRules = resolved?.unit ? await loadRulesForResolvedUnit(resolved.unit) : [];
        const gpsQuote = calculateDeliveryQuote({
          subtotal,
          unit: resolved?.unit ?? null,
          distanceKm: resolved?.distanceKm ?? null,
          rules: gpsRules,
          neighborhood: address.bairro,
          locationSource: "gps",
        });
        console.info("[Maximus][checkout][gps] validação", {
          coords: location,
          unidadeEscolhida: deliveryQuoteUnitLabel(resolved?.unit ?? null),
          taxaCalculada: gpsQuote.fee,
          motivoBloqueio: gpsQuote.blockedReason,
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
    const unit = resolveActiveDeliveryUnit() ?? (await loadActivePublicUnit(selectedUnitSlug));
    setDeliveryLocation({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setDeliveryLocationSource(source);
    setGeocodingStatus(source === "gps" ? "gps_confirmed" : "not_needed");
    setDeliveryUnit(unit);
    setDeliveryDistanceKm(null);
    setDeliveryRangeId(null);
    setLocationConfirmed(true);
    setLocationDenied(false);
    setNoOpenUnits(false);
    const resolved: ResolvedDelivery = {
      location,
      unit,
      distanceKm: null,
      deliveryRangeId: null,
      estimatedMinutes: deliveryQuote.estimatedMinutes,
      locationSource: source,
      geocodingStatus: source === "gps" ? "gps_confirmed" : "not_needed",
    };
    setPendingDelivery(null);
    return resolved;
  }

  async function resolveManualAddressLocation() {
    try {
      setPendingDelivery(null);
      if (!deliveryLocation) {
        const unit = resolveActiveDeliveryUnit() ?? (await loadActivePublicUnit(selectedUnitSlug));
        setDeliveryLocationSource("manual_unavailable");
        setGeocodingStatus("not_needed");
        return {
          location: null,
          unit,
          distanceKm: null,
          deliveryRangeId: null,
          estimatedMinutes: null,
          locationSource: "manual_unavailable" as const,
          geocodingStatus: "not_needed" as GeocodingStatus,
        };
      }

      const nearest = await applyDeliveryLocation(
        deliveryLocation,
        deliveryLocationSource === "gps" ? "gps" : "manual_pin",
      );
      if (!nearest) {
        const unit = resolveActiveDeliveryUnit() ?? (await loadActivePublicUnit(selectedUnitSlug));
        return {
          location: deliveryLocation,
          unit,
          distanceKm: null,
          deliveryRangeId: null,
          estimatedMinutes: null,
          locationSource: deliveryLocationSource === "gps" ? "gps" : ("manual_pin" as const),
          geocodingStatus:
            deliveryLocationSource === "gps" ? "gps_confirmed" : ("not_needed" as GeocodingStatus),
        };
      }

      const location = nearest.location;
      setDeliveryLocation(location);
      setDeliveryLocationSource(deliveryLocationSource === "gps" ? "gps" : "manual_pin");
      setDeliveryUnit(nearest.unit);
      setDeliveryDistanceKm(nearest.distanceKm);
      setDeliveryRangeId(nearest.deliveryRangeId);
      setLocationConfirmed(true);
      setGeocodingStatus(deliveryLocationSource === "gps" ? "gps_confirmed" : "not_needed");
      setDeliveryAddressMode("other");

      console.info("[Maximus][checkout][delivery-pin]", {
        metodo: deliveryLocationSource === "gps" ? "gps" : "manual_pin",
        enderecoReferencia: formatManualAddress({
          street: address.rua.trim(),
          number: address.numero.trim(),
          neighborhood: address.bairro.trim(),
          city: "Santarém",
          state: "Pará",
          postalCode: address.cep.trim() || undefined,
        }),
        latitudeCliente: location?.latitude,
        longitudeCliente: location?.longitude,
        unidadeAtribuida: deliveryQuoteUnitLabel(nearest.unit),
        distanciaKm: nearest.distanceKm,
      });

      const resolved: ResolvedDelivery = {
        location,
        unit: nearest.unit,
        distanceKm: nearest.distanceKm,
        deliveryRangeId: nearest.deliveryRangeId,
        estimatedMinutes: nearest.estimatedMinutes,
        locationSource: deliveryLocationSource === "gps" ? "gps" : "manual_pin",
        geocodingStatus:
          deliveryLocationSource === "gps" ? "gps_confirmed" : ("not_needed" as GeocodingStatus),
        displayAddress: formatManualAddress({
          street: address.rua.trim(),
          number: address.numero.trim(),
          neighborhood: address.bairro.trim(),
          city: "Santarém",
          state: "Pará",
          postalCode: address.cep.trim() || undefined,
        }),
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

  async function repeatLastOrder() {
    const lastOrder = currentCustomer?.orders[0];
    if (!lastOrder) return;
    try {
      const data = await loadPublicMenu(selectedUnitSlug, "delivery");
      const productsByName = new Map(
        data.products.map((product) => [product.name.trim().toLowerCase(), product]),
      );
      let added = 0;
      clearItems();
      for (const item of lastOrder.items) {
        const product = productsByName.get(item.name.trim().toLowerCase());
        if (!product) continue;
        const selections = getDefaultSelections(product);
        for (let index = 0; index < item.quantity; index += 1) {
          addItem(product, selections);
          added += 1;
        }
      }
      if (!added) {
        toast.error("Não foi possível repetir os itens disponíveis desse pedido.");
        return;
      }
      toast.success("Último pedido adicionado à sacola.");
      setStep("mode");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível repetir o pedido.");
    }
  }

  function resolveManualDeliveryUnit() {
    if (deliveryLocation) return deliveryUnit ?? activeUnit;
    if (!selectedUnitSlug) return deliveryUnit ?? activeUnit;
    return (
      units.find(
        (item) => (item.slug === selectedUnitSlug || item.id === selectedUnitSlug) && item.isOpen,
      ) ??
      units.find((item) => item.slug === selectedUnitSlug || item.id === selectedUnitSlug) ??
      deliveryUnit ??
      activeUnit
    );
  }

  function resolveActiveDeliveryUnit() {
    return requestedActiveUnit ?? activeUnit ?? deliveryUnit ?? units[0] ?? null;
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
    consumeMode === "delivery" && !activeIsQrDineIn
      ? "delivery"
      : consumeMode === "mesa" || consumeMode === "local"
        ? "mesa"
        : "retirada";
  const deliveryQuote = calculateDeliveryQuote({
    subtotal,
    unit: resolveManualDeliveryUnit(),
    distanceKm: deliveryDistanceKm,
    rules: deliveryRules,
    deliveryZone: selectedDeliveryZone,
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
        mode={activeIsQrDineIn ? "dine_in" : undefined}
      />
      <div className="mx-auto max-w-lg px-4 pt-6">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {count} {count === 1 ? "item" : "itens"} no pedido
          </span>
          <span className="font-bold text-primary">{formatPrice(subtotal)}</span>
        </div>
      </div>

      {/* ---------- CUSTOMER DATA ---------- */}
      {step === "contact" && (
        <CheckoutShell title="Confirme seus dados" subtitle="Depois escolha como quer receber.">
          <div className="space-y-4">
            {hasSavedProfile && !editingProfile ? (
              <>
                <CustomerProfileCard
                  name={name}
                  phone={phone}
                  onContinue={async () => {
                    await hydrateCustomerFromFields();
                    setStep("mode");
                  }}
                  onChange={() => {
                    setEditingProfile(true);
                    setPrivacyConsent(false);
                  }}
                />
                {currentCustomer?.orders[0] && (
                  <button
                    type="button"
                    onClick={repeatLastOrder}
                    className="w-full rounded-md bg-secondary px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Pedir novamente: {currentCustomer.orders[0].number}
                  </button>
                )}
              </>
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
                <Button
                  className="w-full bg-gradient-primary font-bold"
                  size="lg"
                  disabled={!name || !phone || (!hasSavedProfile && !privacyConsent)}
                  onClick={async () => {
                    await hydrateCustomerFromFields();
                    setEditingProfile(false);
                    setStep("mode");
                  }}
                >
                  {customerLookupLoading ? "Buscando dados..." : "Confirmar dados"}
                </Button>
              </>
            )}
          </div>
        </CheckoutShell>
      )}

      {/* ---------- MODE SELECTION ---------- */}
      {step === "mode" && (
        <CheckoutShell
          title="Como você quer receber seu pedido?"
          subtitle={
            activeIsQrDineIn && effectiveTable
              ? `Pedido da Mesa ${normalizeTableNumber(effectiveTable)}`
              : "Escolha uma opção para continuar."
          }
          onBack={() => navigate({ to: "/menu" })}
        >
          <div className="space-y-3">
            {activeIsQrDineIn && effectiveTable ? (
              <>
                <BigOption
                  label={`Comer na Mesa ${displayMesa}`}
                  description="Será servido diretamente na sua mesa."
                  onClick={() => {
                    setConsumeMode("mesa");
                    setTable(normalizeTableNumber(effectiveTable));
                    setStep("payment");
                  }}
                />
                <BigOption
                  label="Pedir para levar"
                  description="Retire e leve seu pedido."
                  onClick={() => {
                    setConsumeMode("levar");
                    setStep("payment");
                  }}
                />
              </>
            ) : (
              <>
                <BigOption
                  label="Delivery"
                  description="Receba no seu endereço."
                  onClick={() => {
                    void (async () => {
                      await hydrateCustomerFromFields();
                      setConsumeMode("delivery");
                      setStep("location");
                    })();
                  }}
                />
                <BigOption
                  label="Retirar no balcão"
                  description="Retire na loja quando estiver pronto."
                  onClick={() => {
                    setConsumeMode("balcao");
                    setStep("payment");
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

      {/* ---------- DELIVERY: LOCATION PERMISSION ---------- */}
      {step === "location" && (
        <CheckoutShell title="Endereço de entrega" onBack={() => setStep("mode")}>
          {customerLookupLoading ? (
            <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm font-semibold text-muted-foreground">
              Buscando enderecos salvos...
            </p>
          ) : currentCustomer?.addresses.length ? (
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
                setAddressMode("form");
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
                    setResolvedDeliveryZoneId("");
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
                if (currentCustomer.addresses.length >= 3) {
                  toast.error(ADDRESS_LIMIT_MESSAGE);
                  return;
                }
                setSelectedAddressId("");
                setEditingAddressId(null);
                setAddress(EMPTY_ADDRESS);
                setResolvedDeliveryZoneId("");
                setDeliveryLocation(null);
                setDeliveryDistanceKm(null);
                setDeliveryRangeId(null);
                setSaveAsDefault(currentCustomer.addresses.length === 0);
                setAddressMode("start");
                setStep("addressManual");
              }}
            />
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              Informe o endereço para calcular a entrega.
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
                size="sm"
                disabled={subtotal < deliveryQuote.minimumOrderValue || !selectedDeliveryZone}
                onClick={async () => {
                  const nextQuote = calculateDeliveryQuote({
                    subtotal,
                    unit: activeUnit ?? deliveryUnit,
                    distanceKm: null,
                    rules: [],
                    deliveryZone: selectedDeliveryZone,
                    neighborhood: address.bairro,
                    locationSource: "manual_unavailable",
                  });
                  if (nextQuote.fee == null) {
                    toast.error(nextQuote.blockedReason ?? "Não foi possível calcular a entrega.");
                    return;
                  }
                  setStep("payment");
                }}
              >
                Entregar nesse endereço
              </Button>
            )}
            {selectedAddressId && !selectedDeliveryZone && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm font-semibold text-amber-600">
                  Não conseguimos identificar a região de entrega desse endereço.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  size="sm"
                  onClick={() => {
                    setAddressMode("form");
                    setStep("addressManual");
                  }}
                >
                  Ajustar endereço
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => {
                setDeliveryAddressMode("other");
                setPendingDelivery(null);
                setDeliveryLocation(null);
                setDeliveryDistanceKm(null);
                setDeliveryRangeId(null);
                setDeliveryUnit(null);
                setAddressMode("start");
                setStep("addressManual");
              }}
            >
              {currentCustomer?.addresses.length
                ? "Entregar em outro endereço"
                : "Cadastrar endereço"}
            </Button>
          </div>
        </CheckoutShell>
      )}

      {/* ---------- DELIVERY: ADDRESS MANUAL ---------- */}
      {step === "addressManual" && (
        <CheckoutShell
          title={addressMode === "start" ? "Novo Endereço" : "Novo Endereço"}
          subtitle={
            addressMode === "start" ? "Em qual endereço você deseja receber seu pedido?" : undefined
          }
          onBack={() => setStep(currentCustomer?.addresses.length ? "location" : "mode")}
        >
          <div className="space-y-4">
            {addressMode === "start" && (
              <>
                <div className="space-y-2">
                  <Label>Insira seu endereço ou CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      value={addressSearch}
                      onChange={(event) => setAddressSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void searchGoogleAddress();
                      }}
                      placeholder="Rua, bairro ou CEP"
                    />
                    <Button
                      type="button"
                      size="icon"
                      disabled={addressLookupLoading || !googleMapsEnabled}
                      onClick={searchGoogleAddress}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {!googleMapsEnabled && (
                    <p className="text-xs text-muted-foreground">
                      Google Maps não configurado. O preenchimento manual continua disponível.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  ou
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={addressLookupLoading || !googleMapsEnabled}
                  onClick={useBrowserLocation}
                >
                  <LocateFixed className="mr-2 h-4 w-4" /> Usar minha localização
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setAddressMode("form");
                    setDeliveryLocation(
                      deliveryLocation ??
                        (activeUnit
                          ? { latitude: activeUnit.latitude, longitude: activeUnit.longitude }
                          : { latitude: -2.4431, longitude: -54.7083 }),
                    );
                  }}
                >
                  <MapPinned className="mr-2 h-4 w-4" /> Buscar endereço pelo mapa
                </Button>
              </>
            )}
            {addressMode === "form" && (
              <>
                {locationConfirmed && (
                  <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                    <p className="font-bold">Complete o endereço para salvar.</p>
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
                        Arraste para ajustar o marcador.
                      </p>
                    </div>
                  </div>
                  <GoogleAddressMap
                    value={deliveryLocation}
                    fallback={
                      activeUnit
                        ? { latitude: activeUnit.latitude, longitude: activeUnit.longitude }
                        : { latitude: -2.4431, longitude: -54.7083 }
                    }
                    className="h-64 rounded-xl"
                    onChange={async (point) => {
                      setDeliveryLocation(point);
                      setDeliveryLocationSource("manual_pin");
                      try {
                        applyGoogleAddress(
                          await reverseGeocodeLatLng(point.latitude, point.longitude),
                        );
                      } catch (error) {
                        setGeocodingStatus("geocoding_failed");
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Não foi possível buscar o endereço deste ponto.",
                        );
                      }
                    }}
                  />
                  <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
                    Arraste para ajustar o marcador
                  </p>
                  {detectedAddress && (
                    <p className="mt-3 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                      {detectedAddress}
                    </p>
                  )}
                </section>
                <div>
                  <Label className="mb-2 block">Nome do endereço</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Casa", "Trabalho", "Amigos"] as const).map((label) => (
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
                  label="Endereço"
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
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={address.numero === "S/N"}
                    onCheckedChange={(checked) =>
                      setAddress({ ...address, numero: checked ? "S/N" : "" })
                    }
                  />
                  Sem número
                </label>
                <Field
                  label="Bairro"
                  value={address.bairro}
                  onChange={(v) => {
                    const zone = matchDeliveryZone(v, address.rua, detectedAddress, addressSearch);
                    setResolvedDeliveryZoneId(zone?.id ?? "");
                    setAddress({ ...address, bairro: v });
                  }}
                  autoComplete="address-level3"
                />
                <Field
                  label="CEP (opcional)"
                  value={address.cep}
                  onChange={(v) => setAddress({ ...address, cep: v })}
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Cidade"
                    value={address.cidade}
                    onChange={(v) => setAddress({ ...address, cidade: v })}
                    autoComplete="address-level2"
                  />
                  <Field
                    label="Estado"
                    value={address.estado}
                    onChange={(v) => setAddress({ ...address, estado: v })}
                    autoComplete="address-level1"
                  />
                </div>
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
                {!selectedDeliveryZone && address.rua.trim() && address.numero.trim() ? (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600">
                    Não conseguimos identificar a região de entrega desse endereço. Ajuste o pino no
                    mapa ou tente buscar o endereço novamente.
                  </p>
                ) : null}
                <Button
                  className="w-full bg-gradient-primary font-bold"
                  size="lg"
                  disabled={
                    noOpenUnits ||
                    subtotal < deliveryQuote.minimumOrderValue ||
                    !address.rua.trim() ||
                    !address.numero.trim() ||
                    !selectedDeliveryZone
                  }
                  onClick={async () => {
                    const matchingSavedAddress = !editingAddressId
                      ? findSimilarSavedAddress()
                      : null;
                    if (matchingSavedAddress?.deliveryZoneId) {
                      setSelectedAddressId(matchingSavedAddress.id);
                      fillAddress(matchingSavedAddress);
                      applySavedAddressLocation(matchingSavedAddress);
                      setStep("payment");
                      return;
                    }
                    if (
                      !selectedAddressId &&
                      !editingAddressId &&
                      (currentCustomer?.addresses.length ?? 0) >= 3
                    ) {
                      toast.error(ADDRESS_LIMIT_MESSAGE);
                      return;
                    }
                    const nextQuote = calculateDeliveryQuote({
                      subtotal,
                      unit: activeUnit ?? deliveryUnit,
                      distanceKm: null,
                      rules: [],
                      deliveryZone: selectedDeliveryZone ?? resolveZoneFromCurrentAddress(),
                      neighborhood: address.bairro,
                      locationSource: "manual_unavailable",
                    });
                    const autoZone = selectedDeliveryZone ?? resolveZoneFromCurrentAddress();
                    if (!autoZone) {
                      setResolvedDeliveryZoneId("");
                      toast.error(
                        "Não conseguimos identificar a região de entrega desse endereço. Ajuste o pino no mapa ou tente buscar o endereço novamente.",
                      );
                      return;
                    }
                    setResolvedDeliveryZoneId(autoZone.id);
                    if (nextQuote.fee == null) {
                      toast.error("Não foi possível calcular a entrega para esse endereço.");
                      return;
                    }
                    const customer = await persistCustomer();
                    if (!customer) return;
                    const selectedSavedAddress = currentCustomer?.addresses.find(
                      (item) => item.id === selectedAddressId,
                    );
                    if (
                      selectedAddressId &&
                      (editingAddressId || selectedSavedAddress?.deliveryZoneId !== autoZone.id)
                    ) {
                      await saveCurrentAddress(customer.id, deliveryLocation, autoZone);
                    }
                    setStep("payment");
                  }}
                >
                  Salvar
                </Button>
              </>
            )}
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
            else if (consumeMode === "balcao") setStep("mode");
            else if (consumeMode === "levar") setStep("mode");
            else if (consumeMode === "mesa") setStep("mode");
            else if (consumeMode === "local") setStep("local");
            else setStep("mode");
          }}
        >
          <div className="space-y-3">
            <CheckoutReviewSummary
              customerName={name}
              customerPhone={phone}
              address={consumeMode === "delivery" ? address : null}
              paymentLabel="A escolher"
              subtotal={subtotal}
              deliveryFee={consumeMode === "delivery" ? deliveryQuote.fee : 0}
              total={finalTotal}
            />
            <BigOption
              label="Dinheiro"
              description="Informe troco se precisar."
              icon={<Banknote className="h-6 w-6" />}
              onClick={() => setStep("payCash")}
            />
            <BigOption
              label="Cartão"
              description={
                consumeMode === "delivery"
                  ? "Crédito ou débito na entrega."
                  : "Crédito ou débito no atendimento."
              }
              icon={<CreditCard className="h-6 w-6" />}
              onClick={() => setStep("payCard")}
            />
            <BigOption
              label="Pix"
              description="Escolha pagar agora pelo app ou no recebimento."
              icon={<QrCode className="h-6 w-6" />}
              onClick={() => setStep("payPix")}
            />
          </div>
        </CheckoutShell>
      )}

      {/* ---------- PAYMENT: CASH ---------- */}
      {step === "payCash" && (
        <CheckoutShell title="Pagamento em dinheiro" onBack={() => setStep("payment")}>
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
          onBack={() => setStep("payment")}
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

      {/* ---------- PAYMENT: PIX CHOICE ---------- */}
      {step === "payPix" && (
        <CheckoutShell title="Como quer pagar no Pix?" onBack={() => setStep("payment")}>
          <div className="space-y-3">
            <CheckoutReviewSummary
              customerName={name}
              customerPhone={phone}
              address={consumeMode === "delivery" ? address : null}
              paymentLabel="Pix"
              subtotal={subtotal}
              deliveryFee={consumeMode === "delivery" ? deliveryQuote.fee : 0}
              total={finalTotal}
            />
            <BigOption
              label="Pix pelo app"
              description="Copie a chave Pix e envie o pedido aguardando confirmação."
              icon={<Smartphone className="h-6 w-6" />}
              onClick={() => setStep("payApp")}
            />
            <BigOption
              label={
                consumeMode === "delivery"
                  ? "Pix na entrega"
                  : consumeMode === "mesa" || consumeMode === "local"
                    ? "Pix no local"
                    : "Pix na retirada"
              }
              description={
                consumeMode === "delivery"
                  ? "Pague ao entregador quando receber."
                  : "Pague direto no atendimento."
              }
              icon={<QrCode className="h-6 w-6" />}
              onClick={() => setStep("payPixDelivery")}
            />
          </div>
        </CheckoutShell>
      )}

      {/* ---------- PAYMENT: PIX ON DELIVERY ---------- */}
      {step === "payPixDelivery" && (
        <CheckoutShell title="Pix no recebimento" onBack={() => setStep("payPix")}>
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
        <CheckoutShell title="Pagar pelo app (Pix)" onBack={() => setStep("payPix")}>
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
      <p className="text-sm text-muted-foreground">Dados encontrados</p>
      <h3 className="mt-1 text-xl font-black">{name}</h3>
      <p className="mt-1 font-bold text-primary">{phone}</p>
      <Button className="mt-4 w-full bg-gradient-primary font-bold" size="lg" onClick={onContinue}>
        Confirmar
      </Button>
      <Button type="button" variant="ghost" className="mt-2 w-full" onClick={onChange}>
        Editar informações
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
          Entrega: {deliveryQuote.estimatedMinutes ?? "?"} min •{" "}
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
          <h3 className="font-extrabold">Enderecos salvos</h3>
          <p className="text-xs text-muted-foreground">Escolha um endereço salvo.</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-muted-foreground"
        >
          Outro endereço
        </button>
      </div>

      {addresses.length >= 3 && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs font-semibold text-amber-700">
          {ADDRESS_LIMIT_MESSAGE}
        </p>
      )}

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
                <span className="text-xs font-bold text-primary">
                  {selectedAddressId === address.id ? "Selecionado" : "Selecionar"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {address.street}, {address.number} - {address.neighborhood}
              </p>
              {address.deliveryFeeSnapshot != null ? (
                <p className="mt-1 text-sm font-semibold text-primary">
                  Taxa de entrega: {formatPrice(address.deliveryFeeSnapshot)}
                </p>
              ) : (
                <p className="mt-1 text-sm font-semibold text-amber-600">
                  Região de entrega não identificada
                </p>
              )}
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSelect(address)}
                className="rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground"
              >
                Usar este endereco
              </button>
              <button
                type="button"
                onClick={() => onEdit(address)}
                className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground"
              >
                Editar
              </button>
              {!address.isDefault && (
                <button
                  type="button"
                  onClick={() => onDefault(address.id)}
                  className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground"
                >
                  Tornar principal
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(address.id)}
                className="rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive"
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
  subtotal: _subtotal,
  unit,
  distanceKm,
  rules,
  deliveryZone,
  neighborhood: _neighborhood,
  locationSource,
}: {
  subtotal: number;
  unit: GeoUnit | null;
  distanceKm: number | null;
  rules: DeliveryRuleQuote[];
  deliveryZone?: DeliveryZone | null;
  neighborhood: string;
  locationSource: DeliveryLocationSource;
}): DeliveryQuote {
  const minimumOrderValue = unit?.minimumOrderValue ?? 0;

  if (!unit) {
    return {
      fee: null,
      distanceKm: null,
      deliveryRangeId: null,
      estimatedMinutes: null,
      minimumOrderValue,
      maxDistanceKm: 0,
      isFree: false,
      method: "blocked",
      blockedReason: "Não conseguimos carregar a loja agora. Atualize a página e tente novamente.",
    };
  }

  if (!unit.isOpen) {
    return {
      fee: null,
      distanceKm: null,
      deliveryRangeId: null,
      estimatedMinutes: null,
      minimumOrderValue,
      maxDistanceKm: 0,
      isFree: false,
      method: "blocked",
      blockedReason: "A unidade mais próxima está fechada no momento.",
    };
  }

  if (!deliveryZone) {
    return {
      fee: null,
      distanceKm: null,
      deliveryRangeId: null,
      estimatedMinutes: null,
      minimumOrderValue,
      maxDistanceKm: 0,
      isFree: false,
      method: "blocked",
      blockedReason: NO_ZONE_MESSAGE,
    };
  }

  if (!deliveryZone.isActive) {
    return {
      fee: null,
      distanceKm: null,
      deliveryRangeId: null,
      estimatedMinutes: null,
      minimumOrderValue,
      maxDistanceKm: 0,
      isFree: false,
      method: "blocked",
      blockedReason: "Esta região está temporariamente indisponível para entrega.",
    };
  }

  return {
    fee: deliveryZone.fee,
    distanceKm: null,
    deliveryRangeId: null,
    estimatedMinutes: deliveryZone.estimatedTimeMax ?? deliveryZone.estimatedTimeMin ?? null,
    minimumOrderValue,
    maxDistanceKm: 0,
    isFree: deliveryZone.fee === 0,
    method: locationSource === "gps" ? "gps" : "manual_pin",
  };
}

function deliveryQuoteUnitLabel(unit: GeoUnit | null) {
  return unit ? `${unit.name} (${unit.id})` : null;
}
