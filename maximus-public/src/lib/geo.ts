export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type WeekdayKey = "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo";

export interface BusinessHourPeriod {
  opensAt: string;
  closesAt: string;
}

export interface PublicBusinessHour {
  day: WeekdayKey;
  open: boolean;
  periods: BusinessHourPeriod[];
}

export interface GeoUnit extends GeoPoint {
  id: string;
  name: string;
  slug: string;
  isOpen: boolean;
  address?: string;
  phone?: string;
  whatsappPhone?: string;
  businessHours?: PublicBusinessHour[];
  minimumOrderValue?: number;
  baseDeliveryFee?: number;
  deliveryFeePerKm?: number;
  maxDeliveryDistanceKm?: number;
  freeDeliveryFrom?: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceKm(
  originLat: number,
  originLng: number,
  targetLat: number,
  targetLng: number,
): number {
  const dLat = toRadians(targetLat - originLat);
  const dLng = toRadians(targetLng - originLng);
  const lat1 = toRadians(originLat);
  const lat2 = toRadians(targetLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestOpenUnit(
  userLocation: GeoPoint,
  units: GeoUnit[],
): (GeoUnit & { distanceKm: number }) | null {
  const openUnits = units.filter((unit) => unit.isOpen);
  if (openUnits.length === 0) return null;

  return openUnits
    .map((unit) => ({
      ...unit,
      distanceKm: getDistanceKm(
        userLocation.latitude,
        userLocation.longitude,
        unit.latitude,
        unit.longitude,
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}
