import { getSupabaseClient } from "@/lib/supabase";

export type GeocodingStatus =
  | "gps_confirmed"
  | "geocoded"
  | "geocoding_failed"
  | "bairro_fallback"
  | "not_needed";

export interface ManualAddressForGeocoding {
  street: string;
  number: string;
  neighborhood: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface DeliveryCalculationResult {
  deliveryLat: number;
  deliveryLng: number;
  distanceKm: number;
  straightDistanceKm: number | null;
  distanceMultiplier: number | null;
  durationMinutes: number | null;
  rawAddress: string | null;
  unitId: string | null;
  unitName: string | null;
  deliveryFee: number | null;
  deliveryRangeId: string | null;
  minimumOrderValue: number | null;
  total: number | null;
}

export interface ReverseGeocodingResult {
  displayName: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  raw: unknown;
}

type NominatimAddress = Record<string, string | undefined>;

type CalculateDeliveryResponse = {
  ok?: boolean;
  delivery_lat?: number;
  delivery_lng?: number;
  unit_id?: string | null;
  unit_name?: string | null;
  straight_distance_km?: number | null;
  distance_multiplier?: number | null;
  distance_km?: number;
  duration_minutes?: number | null;
  delivery_fee?: number | null;
  delivery_range_id?: string | null;
  minimum_order_value?: number | null;
  total?: number | null;
  raw_address?: string | null;
  error?: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstAddressValue(address: NominatimAddress, keys: string[]) {
  for (const key of keys) {
    const value = address[key];
    if (value?.trim()) return value.trim();
  }
  return "";
}

export function normalizeNeighborhoodName(value: string) {
  return normalizeText(value).toLowerCase();
}

function buildAddressParts(address: ManualAddressForGeocoding) {
  const state = !address.state || address.state.toUpperCase() === "PA" ? "Pará" : address.state;
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.neighborhood,
    address.city || "Santarém",
    state,
    "Brasil",
  ].filter((part): part is string => Boolean(part && part.trim()));
}

export function formatManualAddress(address: ManualAddressForGeocoding) {
  return buildAddressParts(address).join(" · ");
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodingResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");

  console.info("[Maximus][Nominatim][reverse] coords capturadas", { latitude, longitude });

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Nominatim reverse falhou: ${response.status}`);

  const result = (await response.json()) as {
    display_name?: string;
    address?: NominatimAddress;
  };
  const address = result.address ?? {};
  const street = firstAddressValue(address, ["road", "pedestrian", "residential", "footway"]);
  const number = firstAddressValue(address, ["house_number"]);
  const neighborhood = firstAddressValue(address, [
    "neighbourhood",
    "suburb",
    "quarter",
    "city_district",
    "residential",
    "village",
  ]);
  const city = firstAddressValue(address, ["city", "town", "municipality", "village"]);
  const state = firstAddressValue(address, ["state"]);
  const postalCode = firstAddressValue(address, ["postcode"]);

  console.info("[Maximus][Nominatim][reverse] resposta completa", result);
  console.info("[Maximus][Nominatim][reverse] address usado", address);
  console.info("[Maximus][Nominatim][reverse] extraído", {
    rua: street,
    numero: number,
    bairro: neighborhood,
    bairroNormalizado: normalizeNeighborhoodName(neighborhood),
    cidade: city,
    estado: state,
    cep: postalCode,
  });

  if (!result.display_name && !Object.keys(address).length) return null;

  return {
    displayName: result.display_name ?? "",
    street,
    number,
    neighborhood,
    city,
    state,
    postalCode,
    raw: result,
  };
}

export async function calculateDeliveryRoute(params: {
  unitLat: number;
  unitLng: number;
  unitId?: string;
  unitName?: string;
  subtotal?: number;
  units?: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    isOpen: boolean;
    minimumOrderValue?: number;
    baseDeliveryFee?: number;
    deliveryFeePerKm?: number;
    maxDeliveryDistanceKm?: number;
    freeDeliveryFrom?: number;
    deliveryRules?: Array<{
      id: string;
      maxDistanceKm: number;
      estimatedMinutes: number;
      deliveryFee: number;
      isActive?: boolean;
    }>;
  }>;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string;
}): Promise<DeliveryCalculationResult> {
  const supabase = getSupabaseClient();
  console.info("[Maximus][delivery-function] chamada", {
    unitLat: params.unitLat,
    unitLng: params.unitLng,
    unitId: params.unitId,
    unitName: params.unitName,
    subtotal: params.subtotal,
    units: params.units?.map((unit) => unit.id),
    deliveryLat: params.deliveryLat,
    deliveryLng: params.deliveryLng,
    deliveryAddress: params.deliveryAddress,
    method: "coordinates_haversine",
  });

  const { data, error } = await supabase.functions.invoke<CalculateDeliveryResponse>(
    "calculate-delivery",
    {
      body: {
        unit_lat: params.unitLat,
        unit_lng: params.unitLng,
        unit_id: params.unitId,
        unit_name: params.unitName,
        subtotal: params.subtotal,
        units: params.units?.map((unit) => ({
          id: unit.id,
          name: unit.name,
          latitude: unit.latitude,
          longitude: unit.longitude,
          is_open: unit.isOpen,
          minimum_order_value: unit.minimumOrderValue,
          base_delivery_fee: unit.baseDeliveryFee,
          delivery_fee_per_km: unit.deliveryFeePerKm,
          max_delivery_distance_km: unit.maxDeliveryDistanceKm,
          free_delivery_from: unit.freeDeliveryFrom,
          delivery_rules: unit.deliveryRules?.map((rule) => ({
            id: rule.id,
            max_distance_km: rule.maxDistanceKm,
            estimated_minutes: rule.estimatedMinutes,
            delivery_fee: rule.deliveryFee,
            active: rule.isActive !== false,
          })),
        })),
        delivery_lat: params.deliveryLat,
        delivery_lng: params.deliveryLng,
        delivery_address: params.deliveryAddress,
      },
    },
  );

  console.info("[Maximus][delivery-function] resposta", { data, error });

  if (error) throw new Error(error.message || "Não foi possível calcular a entrega.");
  if (data?.ok === false)
    throw new Error(data.error || "Erro ao calcular entrega. Tente novamente.");
  if (data?.error) throw new Error(data.error);

  const deliveryLat = Number(data?.delivery_lat);
  const deliveryLng = Number(data?.delivery_lng);
  const distanceKm = Number(data?.distance_km);
  if (!Number.isFinite(deliveryLat) || !Number.isFinite(deliveryLng)) {
    throw new Error("Confirme o local da entrega pelo GPS ou marque no mapa.");
  }
  if (!Number.isFinite(distanceKm)) {
    throw new Error("Não foi possível calcular a distância da entrega.");
  }

  return {
    deliveryLat,
    deliveryLng,
    distanceKm,
    straightDistanceKm: Number.isFinite(data?.straight_distance_km)
      ? Number(data?.straight_distance_km)
      : null,
    distanceMultiplier: Number.isFinite(data?.distance_multiplier)
      ? Number(data?.distance_multiplier)
      : null,
    durationMinutes: Number.isFinite(data?.duration_minutes)
      ? Number(data?.duration_minutes)
      : null,
    rawAddress: data?.raw_address ?? null,
    unitId: data?.unit_id ?? null,
    unitName: data?.unit_name ?? null,
    deliveryFee: Number.isFinite(data?.delivery_fee) ? Number(data?.delivery_fee) : null,
    deliveryRangeId: data?.delivery_range_id ?? null,
    minimumOrderValue: Number.isFinite(data?.minimum_order_value)
      ? Number(data?.minimum_order_value)
      : null,
    total: Number.isFinite(data?.total) ? Number(data?.total) : null,
  };
}
