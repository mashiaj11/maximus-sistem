import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { FoodArt } from "@/components/FoodArt";
import type { Category } from "@/lib/types";
import { loadPublicMenu } from "@/lib/supabase-data";

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

function Index() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadPublicMenu()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Hero orderLink="/menu" />

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
    </div>
  );
}
