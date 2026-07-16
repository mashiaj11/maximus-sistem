import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Utensils } from "lucide-react";
import { CartDrawer } from "@/components/CartDrawer";
import { FoodArt } from "@/components/FoodArt";
import { Logo } from "@/components/Logo";
import { ProductCard } from "@/components/ProductCard";
import { loadPublicMenu } from "@/lib/supabase-data";
import { useCart } from "@/lib/store";
import type { Category, CategoryId, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MesaSearch {
  unit?: string;
  unidade?: string;
  table?: string;
  mesa?: string;
}

function normalizeSearchTable(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  const numericMatch = normalized.match(/\d+/);

  if (numericMatch) {
    return String(Number(numericMatch[0]));
  }

  return normalized;
}

export const Route = createFileRoute("/mesa")({
  validateSearch: (search: Record<string, unknown>): MesaSearch => {
    const table = normalizeSearchTable(search.table ?? search.mesa ?? search.table_number);

    const unitValue = search.unit ?? search.unidade ?? search.unit_id ?? search.unit_slug;

    const unit = typeof unitValue === "string" && unitValue.trim() ? unitValue.trim() : undefined;

    return {
      ...(unit ? { unit, unidade: unit } : {}),
      ...(table ? { table, mesa: table } : {}),
    };
  },

  head: () => ({
    meta: [
      { title: "Mesa - Maximus" },
      { name: "description", content: "Cardápio interno de mesa da Maximus." },
    ],
  }),
  component: MesaPage,
});

function formatTable(value?: string) {
  if (!value) return "";
  const number = Number(value);
  return Number.isFinite(number) ? String(number).padStart(2, "0") : value;
}

function MesaPage() {
  const { unit, unidade, table, mesa } = Route.useSearch();
  const qrUnit = unit ?? unidade;
  const qrTable = table ?? mesa;
  const displayTable = formatTable(qrTable);
  const checkoutSearch = useMemo<MesaSearch & { mode: "dine_in" }>(
    () => ({
      ...(qrUnit ? { unit: qrUnit, unidade: qrUnit } : {}),
      ...(qrTable ? { table: qrTable, mesa: qrTable } : {}),
      mode: "dine_in" as const,
    }),
    [qrTable, qrUnit],
  );
  const { setOrderContext } = useCart();
  const [active, setActive] = useState<CategoryId | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [unitName, setUnitName] = useState("");
  const [allUnitsClosed, setAllUnitsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!qrUnit || !qrTable) return;
    setOrderContext({
      unit: qrUnit,
      table: qrTable,
      mode: "dine_in",
      source: "qr",
    });
  }, [qrTable, qrUnit, setOrderContext]);

  useEffect(() => {
    if (!qrUnit || !qrTable) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadPublicMenu(qrUnit, "dine_in")
      .then((data) => {
        const selectedUnit = data.units.find((item) => item.slug === qrUnit || item.id === qrUnit);
        if (!selectedUnit) {
          setUnitName(qrUnit);
          setCategories([]);
          setProducts([]);
          setAllUnitsClosed(false);
          setError("Unidade não identificada. Escaneie novamente o QR Code da mesa.");
          return;
        }
        setUnitName(selectedUnit.name);
        setCategories(data.categories);
        setProducts(data.products);
        setAllUnitsClosed(data.allUnitsClosed);
        setError(null);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : "Não foi possível carregar o cardápio.",
        );
      })
      .finally(() => setLoading(false));
  }, [qrTable, qrUnit]);

  const selectedCategory = categories.find((category) => category.id === active);
  const list = active ? products.filter((product) => product.category === active) : [];

  if (!qrUnit || !qrTable) {
    return (
      <div className="min-h-screen pb-28 sm:pb-16">
        <MesaHeader checkoutSearch={checkoutSearch} />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-sm font-semibold text-destructive">
            Mesa não identificada. Escaneie novamente o QR Code.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 sm:pb-16">
      <MesaHeader checkoutSearch={checkoutSearch} />

      <div className="border-b border-primary/30 bg-primary/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 text-sm font-bold text-primary">
          <Utensils className="h-4 w-4" />
          <span>{unitName || qrUnit}</span>
          <span className="text-muted-foreground">•</span>
          <span>Mesa {displayTable}</span>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {allUnitsClosed ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Estamos fechados agora
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
              Cardápio da mesa indisponível
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O atendimento retorna conforme os horários cadastrados da unidade.
            </p>
          </div>
        ) : !active ? (
          <>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Cardápio da mesa
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

            {!loading && !error && categories.length === 0 && (
              <div className="rounded-lg border border-border bg-card p-5 text-sm font-semibold text-muted-foreground">
                Nenhuma categoria disponível para consumo no local.
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-3">
              {list.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MesaHeader({ checkoutSearch }: { checkoutSearch: MesaSearch & { mode: "dine_in" } }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <CartDrawer checkoutSearch={checkoutSearch} />
      </div>
    </header>
  );
}
