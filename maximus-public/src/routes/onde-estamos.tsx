import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, LocateFixed, MessageCircle, Navigation } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getDistanceKm, type GeoUnit } from "@/lib/geo";
import { loadPublicUnits } from "@/lib/supabase-data";

export const Route = createFileRoute("/onde-estamos")({
  head: () => ({
    meta: [{ title: "Onde estamos - Maximus" }],
  }),
  component: WherePage,
});

type WhereUnit = GeoUnit & { address?: string };

function WherePage() {
  const [nearestId, setNearestId] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [units, setUnits] = useState<WhereUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);

  useEffect(() => {
    loadPublicUnits()
      .then((loadedUnits) => setUnits(loadedUnits))
      .catch(() => setLocationStatus("Não foi possível carregar as unidades do Supabase."))
      .finally(() => setLoadingUnits(false));
  }, []);

  function useLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Seu navegador não oferece localização.");
      return;
    }
    setLocationStatus("Solicitando permissão de localização...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const ranked = units
          .map((unit) => ({
            ...unit,
            distance: getDistanceKm(
              position.coords.latitude,
              position.coords.longitude,
              unit.latitude,
              unit.longitude,
            ),
          }))
          .sort((a, b) => a.distance - b.distance);
        setNearestId(ranked[0]?.id ?? null);
        setLocationStatus(
          ranked[0]
            ? `${ranked[0].name} parece ser a unidade mais próxima.`
            : "Não encontramos unidade próxima.",
        );
      },
      () => setLocationStatus("Permissão negada ou não foi possível obter sua localização."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">Onde estamos</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha uma unidade, abra no mapa ou chame no WhatsApp.
            </p>
          </div>
          <Button variant="outline" onClick={useLocation}>
            <LocateFixed className="mr-2 h-4 w-4" />
            Usar minha localização
          </Button>
        </div>

        {locationStatus && (
          <p className="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground">
            {locationStatus}
          </p>
        )}

        {loadingUnits && (
          <p className="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground">
            Carregando unidades...
          </p>
        )}

        {!loadingUnits && units.length === 0 && (
          <p className="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground">
            Nenhuma unidade ativa encontrada.
          </p>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {units.map((unit) => (
            <article
              key={unit.id}
              className={`rounded-2xl border bg-card p-5 ${
                nearestId === unit.id
                  ? "border-primary shadow-sm ring-1 ring-primary/30"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    {nearestId === unit.id ? "Mais próxima" : "Unidade"}
                  </p>
                  <h2 className="mt-2 text-2xl font-black">{unit.name}</h2>
                </div>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{unit.address}</p>
              <p className="mt-1 text-sm font-semibold">{unit.phone ?? ""}</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <a
                  className="rounded-lg bg-secondary px-3 py-2 text-center text-xs font-bold"
                  href={mapUrl(unit)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver no mapa
                </a>
                <a
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  href={routeUrl(unit)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Como chegar
                </a>
                <a
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                  href={whatsappUrl(unit.whatsappPhone ?? unit.phone ?? "")}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              </div>
            </article>
          ))}
        </div>

        <Button asChild size="lg" className="mt-8 w-full bg-gradient-primary font-bold">
          <Link to="/menu">Fazer pedido agora</Link>
        </Button>
      </div>
    </div>
  );
}

function mapUrl(unit: WhereUnit) {
  return `https://www.google.com/maps/search/?api=1&query=${unit.latitude},${unit.longitude}`;
}

function routeUrl(unit: WhereUnit) {
  return `https://www.google.com/maps/dir/?api=1&destination=${unit.latitude},${unit.longitude}`;
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}
