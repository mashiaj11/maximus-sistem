import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-black">Política de privacidade</h1>
        <div className="mt-5 space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Usamos nome, telefone, endereço e histórico de pedidos apenas para operar pedidos da
            Maximus.
          </p>
          <p>Não solicitamos CPF, RG ou data de nascimento no pedido público.</p>
          <p>Você pode solicitar a exclusão dos seus dados a qualquer momento.</p>
          <Link to="/excluir-dados" className="inline-flex font-bold text-primary underline">
            Solicitar exclusão de dados
          </Link>
        </div>
      </main>
    </div>
  );
}
