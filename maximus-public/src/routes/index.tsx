import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { FoodArt } from "@/components/FoodArt";
import type { Category } from "@/lib/types";
import { loadPublicMenu } from "@/lib/supabase-data";
import type { GeoUnit } from "@/lib/geo";
import { formatBusinessHours } from "@/lib/business-hours";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maximus Hamburguer e Churrasco" },
      {
        name: "description",
        content:
          "Hambúrguer artesanal, churrasco na brasa, chopp gelado e petiscos. Peça online na Maximus.",
      },
      { property: "og:title", content: "Maximus Hamburguer e Churrasco" },
      {
        property: "og:description",
        content: "Hambúrguer artesanal, churrasco na brasa, chopp gelado e petiscos.",
      },
    ],
  }),
  component: Index,
});

const TODAY_KEYS = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
] as const;

function getClosedHeroHoursText(units: GeoUnit[]) {
  const today = TODAY_KEYS[new Date().getDay()];
  const todayHour = units
    .map((unit) => unit.businessHours?.find((hour) => hour.day === today && hour.open))
    .find((hour) => hour?.periods.some((period) => period.opensAt && period.closesAt));
  const periods = todayHour?.periods
    .filter((period) => period.opensAt && period.closesAt)
    .map((period) => `${period.opensAt} às ${period.closesAt}`)
    .join(", ");
  return periods ? `Funcionamento: ${periods}` : undefined;
}

function Index() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<GeoUnit[]>([]);
  const [allUnitsClosed, setAllUnitsClosed] = useState(false);

  useEffect(() => {
    loadPublicMenu()
      .then((data) => {
        setCategories(data.categories);
        setUnits(data.units);
        setAllUnitsClosed(data.allUnitsClosed);
      })
      .catch(() => {
        setCategories([]);
        setUnits([]);
      });
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Hero
        orderLink="/menu"
        isClosed={allUnitsClosed}
        closedHoursText={getClosedHeroHoursText(units)}
      />

      {allUnitsClosed && (
        <section className="mx-auto max-w-6xl px-4 pt-10">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Estamos fechados agora
            </p>
            <h2 className="mt-2 text-2xl font-extrabold">Cardápio e checkout indisponíveis</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Consulte abaixo nossos endereços, horários cadastrados e status de cada unidade.
            </p>
          </div>
        </section>
      )}

      {!allUnitsClosed && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Explore o cardápio</h2>
            <Link
              to="/menu"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Ver tudo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/menu"
                hash={c.id}
                className="group flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-5 text-center transition-colors hover:border-primary/70"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-md border border-border bg-secondary text-3xl transition-colors group-hover:border-primary/70">
                  <FoodArt
                    variant={c.svg}
                    className="h-12 w-12 transition-transform group-hover:scale-110"
                  />
                </div>
                <span className="text-sm font-bold uppercase tracking-[0.06em]">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {allUnitsClosed && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Onde estamos</h2>
            <Link
              to="/onde-estamos"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Ver unidades <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {units.map((unit) => (
              <article key={unit.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">{unit.name}</h3>
                    <p className="mt-2 flex gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      {unit.address}
                    </p>
                  </div>
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs font-bold text-muted-foreground">
                    {unit.isOpen ? "Aberta" : "Fechada"}
                  </span>
                </div>
                <div className="mt-4 space-y-1 text-xs font-semibold text-muted-foreground">
                  {formatBusinessHours(unit.businessHours).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
