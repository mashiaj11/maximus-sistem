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

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  importance: number;
  type?: string;
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
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.neighborhood,
    address.city || "Santarém",
    address.state || "PA",
    address.postalCode,
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

export async function geocodeManualAddress(
  address: ManualAddressForGeocoding,
): Promise<GeocodingResult | null> {
  const query = buildAddressParts(address).join(", ");
  if (!address.street.trim() || !address.number.trim() || !address.neighborhood.trim()) {
    return null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("q", query);

  console.info("[Maximus][Nominatim] endereço recebido", { address, query });

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Nominatim falhou: ${response.status}`);

  const results = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
    importance?: number;
    type?: string;
  }>;
  const first = results[0];

  console.info("[Maximus][Nominatim] resultado", first ?? null);

  if (!first?.lat || !first.lon) return null;
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    displayName: first.display_name ?? query,
    importance: Number(first.importance ?? 0),
    type: first.type,
  };
}
