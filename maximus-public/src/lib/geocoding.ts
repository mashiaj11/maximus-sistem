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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
