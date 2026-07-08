import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/excluir-dados")({
  component: DeleteDataPage,
});

function DeleteDataPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-black">Solicitar exclusão de dados</h1>
        <div className="mt-5 space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Para solicitar exclusão, entre em contato com a Maximus informando o telefone usado nos
            pedidos.
          </p>
          <p>
            A equipe localizará o cadastro e removerá dados pessoais conforme a legislação
            aplicável.
          </p>
        </div>
      </main>
    </div>
  );
}
