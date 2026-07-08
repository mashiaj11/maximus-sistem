import { createClientOnlyFn } from "@tanstack/react-start";
import { lazy, Suspense } from "react";
import { ClientOnly } from "./ClientOnly";

export interface MapPoint {
  latitude: number;
  longitude: number;
  label: string;
  color?: string;
}

type MapViewProps = {
  points: MapPoint[];
  route?: Array<[number, number]>;
  className?: string;
};

type DeliveryRouteMapProps = {
  origin?: MapPoint;
  destination?: MapPoint;
  driver?: MapPoint;
  className?: string;
};

type LocationPickerMapProps = {
  value: { latitude: number; longitude: number } | null;
  fallback?: { latitude: number; longitude: number };
  onChange: (point: { latitude: number; longitude: number }) => void;
  className?: string;
};

const loadClientMap = createClientOnlyFn(() => import("./DeliveryMap.client"));

const ClientMapView = lazy(() =>
  loadClientMap()!.then((module) => ({ default: module.MapViewClient })),
);
const ClientDeliveryRouteMap = lazy(() =>
  loadClientMap()!.then((module) => ({ default: module.DeliveryRouteMapClient })),
);
const ClientLocationPickerMap = lazy(() =>
  loadClientMap()!.then((module) => ({ default: module.LocationPickerMapClient })),
);

export function MapView(props: MapViewProps) {
  const fallback = <MapFallback className={props.className} />;

  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <ClientMapView {...props} />
      </Suspense>
    </ClientOnly>
  );
}

export function DeliveryRouteMap(props: DeliveryRouteMapProps) {
  const fallback = (
    <div className="overflow-hidden rounded-xl border border-border">
      <MapFallback className={props.className ?? "h-72 w-full"} />
    </div>
  );

  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <ClientDeliveryRouteMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}

export function LocationPickerMap(props: LocationPickerMapProps) {
  const fallback = <MapFallback className={props.className} />;

  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <ClientLocationPickerMap {...props} />
      </Suspense>
    </ClientOnly>
  );
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
