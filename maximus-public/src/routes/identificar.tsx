import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import {
  confirmCustomerForSession,
  getSavedCustomerProfile,
  normalizePhone,
  saveCustomer,
} from "@/lib/customer";

type IdentifySearch = { unit?: string; table?: string; mode?: string };

export const Route = createFileRoute("/identificar")({
  validateSearch: (search: Record<string, unknown>): IdentifySearch => ({
    unit: typeof search.unit === "string" ? search.unit : undefined,
    table: typeof search.table === "string" ? search.table : undefined,
    mode: typeof search.mode === "string" ? search.mode : undefined,
  }),
  component: IdentifyPage,
});

function IdentifyPage() {
  const saved = getSavedCustomerProfile();
  const { unit, table, mode } = Route.useSearch();
  const navigate = useNavigate();

  const [name, setName] = useState(saved?.name ?? "");
  const [phone, setPhone] = useState(saved?.phone ?? "");
  const [consent, setConsent] = useState(Boolean(saved));
  const [loading, setLoading] = useState(false);

  async function confirm() {
    const cleanPhone = normalizePhone(phone);

    if (name.trim().length < 2) {
      toast.error("Informe seu nome.");
      return;
    }

    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      toast.error("Informe um telefone válido.");
      return;
    }

    if (!consent) {
      toast.error("Aceite os termos e a política de privacidade para continuar.");
      return;
    }

    setLoading(true);

    try {
      await saveCustomer({ name, phone: cleanPhone });
      confirmCustomerForSession();

      await navigate({
        to: "/menu",
        search: {
          ...(unit ? { unit, unidade: unit } : {}),
          ...(table ? { table, mesa: table } : {}),
          ...(mode ? { mode } : {}),
        },
        replace: true,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível confirmar seus dados.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto flex max-w-md flex-col px-4 py-12">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Maximus</p>

        <h1 className="mt-2 text-3xl font-black">Antes de abrir o cardápio</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Confirme seus dados para carregarmos seus endereços e pedidos anteriores.
        </p>

        <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="space-y-2">
            <label htmlFor="customer-name" className="text-sm font-bold">
              Nome
            </label>

            <input
              id="customer-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="customer-phone" className="text-sm font-bold">
              Telefone
            </label>

            <input
              id="customer-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 h-4 w-4"
            />

            <span>Concordo com os termos de uso e a política de privacidade.</span>
          </label>

          <button
            type="button"
            disabled={loading}
            onClick={confirm}
            className="h-11 w-full rounded-md bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Buscando seus dados..." : "Confirmar e abrir cardápio"}
          </button>
        </section>
      </main>
    </div>
  );
}
