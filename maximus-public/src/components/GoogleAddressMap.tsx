import { useEffect, useRef, useState } from "react";
import { getGoogleMaps, loadGoogleMapsScript } from "@/lib/google-maps";

export function GoogleAddressMap({
  value,
  fallback,
  onChange,
  className,
}: {
  value: { latitude: number; longitude: number } | null;
  fallback?: { latitude: number; longitude: number };
  onChange: (point: { latitude: number; longitude: number }) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ setCenter?: (position: { lat: number; lng: number }) => void } | null>(
    null,
  );
  const markerRef = useRef<{
    setPosition: (position: { lat: number; lng: number }) => void;
    addListener: (eventName: string, callback: (...args: unknown[]) => void) => void;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const center = value ?? fallback ?? { latitude: -2.4431, longitude: -54.7083 };

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const maps = getGoogleMaps();
        if (!maps) throw new Error("Google Maps não carregado.");
        const position = { lat: center.latitude, lng: center.longitude };
        const map = new maps.Map(containerRef.current, {
          center: position,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const marker = new maps.Marker({
          position,
          map,
          draggable: true,
          title: "Local da entrega",
        });
        marker.addListener("dragend", (event: unknown) => {
          const latLng = (event as { latLng?: { lat: () => number; lng: () => number } }).latLng;
          if (!latLng) return;
          onChange({ latitude: latLng.lat(), longitude: latLng.lng() });
        });
        mapRef.current = map as { setCenter?: (position: { lat: number; lng: number }) => void };
        markerRef.current = marker;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Mapa indisponível."));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const position = { lat: center.latitude, lng: center.longitude };
    markerRef.current?.setPosition(position);
    mapRef.current?.setCenter?.(position);
  }, [center.latitude, center.longitude]);

  if (error) {
    return (
      <div
        className={`grid place-items-center bg-secondary px-4 text-center text-sm text-muted-foreground ${
          className ?? "h-64 rounded-xl"
        }`}
      >
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className={className ?? "h-64 rounded-xl"} />;
}
