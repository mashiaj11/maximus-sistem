import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Info, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { FoodArt } from "@/components/FoodArt";
import { ProductCard } from "@/components/ProductCard";
import type { Category, CategoryId, Product } from "@/lib/types";
import { loadPublicMenu } from "@/lib/supabase-data";
import { useCart } from "@/lib/store";
import { cn, normalizeMesa } from "@/lib/utils";
import type { GeoUnit } from "@/lib/geo";
import { formatBusinessHours } from "@/lib/business-hours";

interface MenuSearch {
  mesa?: string;
  table?: string;
  unidade?: string;
  unit?: string;
  mode?: string;
}

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>): MenuSearch => {
    const table = normalizeMesa(search.mesa ?? search.table ?? search.table_number);
    const unit =
      typeof search.unidade === "string"
        ? search.unidade
        : typeof search.unit === "string"
          ? search.unit
          : typeof search.unit_id === "string"
            ? search.unit_id
            : typeof search.unit_slug === "string"
              ? search.unit_slug
              : undefined;
    return {
      mesa: table,
      table,
      unidade: unit,
      unit,
      mode: typeof search.mode === "string" ? search.mode : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Cardápio — Maximus" },
      {
        name: "description",
        content: "Escolha hambúrgueres, churrasco, petiscos, chopp e bebidas na Maximus.",
      },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const { mesa, table, unidade, unit, mode } = Route.useSearch();
  const navigate = useNavigate();
  const qrTable = mesa ?? table;
  const qrUnit = unidade ?? unit;
  const search = useMemo(
    () => ({ unit: qrUnit, unidade: qrUnit, table: qrTable, mesa: qrTable, mode }),
    [mode, qrTable, qrUnit],
  );
  const { orderContext, setOrderContext } = useCart();
  const effectiveMesa = qrTable ?? orderContext?.table;
  const effectiveUnidade = qrUnit ?? orderContext?.unit;
  const effectiveMode = mode ?? orderContext?.mode;
  const effectiveIsDineIn = effectiveMode === "dine_in" || Boolean(effectiveMesa);
  const [active, setActive] = useState<CategoryId | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<GeoUnit[]>([]);
  const [allUnitsClosed, setAllUnitsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("MENU QR CONTEXT", {
      arquivo: "maximus-public/src/routes/menu.tsx",
      search,
      unit: effectiveUnidade,
      table: effectiveMesa,
      mode: effectiveMode,
      orderContext,
    });
  }, [effectiveMesa, effectiveMode, effectiveUnidade, orderContext, search]);

  useEffect(() => {
    if (mode !== "dine_in" || !qrTable) return;
    setOrderContext({
      unit: qrUnit,
      table: qrTable,
      mode: "dine_in",
      source: "qr",
    });
    if (!qrUnit) return;
    if (unit === qrUnit && unidade === qrUnit && table === qrTable && mesa === qrTable) return;
    void navigate({
      to: "/menu",
      search: {
        unit: qrUnit,
        unidade: qrUnit,
        table: qrTable,
        mesa: qrTable,
        mode: "dine_in",
      },
      replace: true,
    });
  }, [mesa, mode, navigate, qrTable, qrUnit, setOrderContext, table, unidade, unit]);

  useEffect(() => {
    setLoading(true);
    loadPublicMenu(effectiveUnidade, effectiveIsDineIn ? "dine_in" : "delivery")
      .then((data) => {
        setCategories(data.categories);
        setProducts(data.products);
        setUnits(data.units);
        setAllUnitsClosed(data.allUnitsClosed);
        setError(null);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : "Não foi possível carregar o cardápio.",
        );
      })
      .finally(() => setLoading(false));
  }, [effectiveIsDineIn, effectiveUnidade]);

  const selectedCategory = categories.find((c) => c.id === active);
  const list = active ? products.filter((p) => p.category === active) : [];

  return (
    <div className="min-h-screen pb-16">
      <SiteHeader
        mesa={effectiveMesa}
        unidade={effectiveUnidade}
        mode={effectiveIsDineIn ? "dine_in" : undefined}
      />

      {effectiveIsDineIn && effectiveMesa && (
        <div className="bg-primary/10 border-b border-primary/30">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm font-medium text-primary">
            <Info className="h-4 w-4" />
            Origem: loja física • Mesa {effectiveMesa}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        {allUnitsClosed ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Estamos fechados agora
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
                Cardápio indisponível
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Confira endereços, horários cadastrados e status das unidades.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {units.map((unit) => (
                <article key={unit.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black">{unit.name}</h2>
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
          </div>
        ) : !active ? (
          <>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Cardápio Maximus
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Escolha uma categoria</h1>
            </div>

            {loading && (
              <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
                Carregando cardápio...
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-sm font-semibold text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {categories.map((category) => {
                const count = products.filter((product) => product.category === category.id).length;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActive(category.id)}
                    className={cn(
                      "group min-h-[172px] cursor-pointer overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/70 hover:bg-primary/10",
                      active === category.id && "border-primary bg-primary/10",
                    )}
                  >
                    <div className="flex h-28 items-center justify-center border-b border-border bg-black/40 p-5 sm:h-36">
                      <FoodArt
                        variant={category.svg}
                        className="h-full w-auto opacity-90 transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3 sm:p-4">
                      <h2 className="text-sm font-black uppercase tracking-[0.08em] sm:text-base">
                        {category.label}
                      </h2>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {count} {count === 1 ? "produto" : "produtos"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setActive(null)}
              className="mb-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold hover:border-primary/70 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para categorias
            </button>

            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  Categoria
                </p>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
                  {selectedCategory?.label}
                </h1>
              </div>
              <p className="text-sm font-semibold text-muted-foreground">
                {list.length} {list.length === 1 ? "produto" : "produtos"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
