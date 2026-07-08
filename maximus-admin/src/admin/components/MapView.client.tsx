import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import type { MapPoint } from "./MapView";

const DEFAULT_CENTER = { latitude: -2.4431, longitude: -54.7083, label: "Maximus" };

export function MapViewClient({
  points,
  route,
  className,
}: {
  points: MapPoint[];
  route?: Array<[number, number]>;
  className?: string;
}) {
  const validPoints = points.filter(isValidPoint);
  const validRoute = route?.filter(([latitude, longitude]) =>
    isValidCoordinate(latitude, longitude),
  );
  const center = validPoints[0] ?? DEFAULT_CENTER;

  if (!validPoints.length && (!validRoute || validRoute.length < 2)) {
    return <MapFallback className={className} />;
  }

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={13}
      className={className ?? "h-64 rounded-xl"}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {validRoute && validRoute.length >= 2 && (
        <Polyline positions={validRoute} pathOptions={{ color: "#f97316", weight: 4 }} />
      )}
      {validPoints.map((point) => (
        <CircleMarker
          key={`${point.label}-${point.latitude}-${point.longitude}`}
          center={[point.latitude, point.longitude]}
          pathOptions={{
            color: point.color ?? "#f97316",
            fillColor: point.color ?? "#f97316",
            fillOpacity: 0.85,
          }}
          radius={9}
        >
          <Popup>{point.label}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export function DeliveryRouteMapClient({
  origin,
  destination,
  driver,
  className,
}: {
  origin?: MapPoint;
  destination?: MapPoint;
  driver?: MapPoint;
  className?: string;
}) {
  const points = [origin, destination, driver].filter(isValidPoint);
  const line = [origin, driver, destination]
    .filter(isValidPoint)
    .map((point) => [point.latitude, point.longitude] as [number, number]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <MapViewClient points={points} route={line} className={className ?? "h-72 w-full"} />
    </div>
  );
}

function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function isValidPoint(point: MapPoint | undefined): point is MapPoint {
  return Boolean(point && isValidCoordinate(point.latitude, point.longitude));
}

function MapFallback({ className }: { className?: string }) {
  return (
    <div
      className={`grid place-items-center bg-secondary text-center text-sm text-muted-foreground ${
        className ?? "h-64 rounded-xl"
      }`}
    >
      Localização ainda não confirmada
    </div>
  );
}
