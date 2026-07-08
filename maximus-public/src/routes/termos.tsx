import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-black">Termos de uso</h1>
        <div className="mt-5 space-y-4 text-sm leading-6 text-muted-foreground">
          <p>Ao fazer um pedido, você confirma que as informações fornecidas estão corretas.</p>
          <p>
            Pedidos pagos via Pix pelo app ficam aguardando confirmação da Maximus antes de avançar.
          </p>
          <p>
            Pedidos para entrega dependem da disponibilidade da unidade e das regras de entrega
            cadastradas.
          </p>
        </div>
      </main>
    </div>
  );
}
