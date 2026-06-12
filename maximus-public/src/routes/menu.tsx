import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Info } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { FoodArt } from "@/components/FoodArt";
import { ProductCard } from "@/components/ProductCard";
import type { Category, CategoryId, Product } from "@/lib/types";
import { loadPublicMenu } from "@/lib/supabase-data";
import { cn, normalizeMesa } from "@/lib/utils";

interface MenuSearch {
  mesa?: string;
  unidade?: string;
}

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>): MenuSearch => ({
    mesa: normalizeMesa(search.mesa),
    unidade: typeof search.unidade === "string" ? search.unidade : undefined,
  }),
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
  const { mesa, unidade } = Route.useSearch();
  const [active, setActive] = useState<CategoryId | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    loadPublicMenu(unidade, Boolean(mesa))
      .then((data) => {
        setCategories(data.categories);
        setProducts(data.products);
        setError(null);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : "Não foi possível carregar o cardápio.",
        );
      })
      .finally(() => setLoading(false));
  }, [mesa, unidade]);

  const selectedCategory = categories.find((c) => c.id === active);
  const list = active ? products.filter((p) => p.category === active) : [];

  return (
    <div className="min-h-screen pb-16">
      <SiteHeader mesa={mesa} unidade={unidade} />

      {mesa && (
        <div className="bg-primary/10 border-b border-primary/30">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm font-medium text-primary">
            <Info className="h-4 w-4" />
            Origem: loja física • Mesa {mesa}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        {!active ? (
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
