import { createFileRoute } from "@tanstack/react-router";
import { Copy, Plus, Printer, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import { TABLE_STATUS_LABELS } from "@/admin/data/tables";
import type { RestaurantTable, TableStatus } from "@/admin/data/types";
import { useAdmin } from "@/admin/store";

export const Route = createFileRoute("/admin/mesas")({
  component: MesasPage,
});

const STATUS_STYLE: Record<TableStatus, string> = {
  livre: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  ocupada: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  pedido_ativo: "border-primary/40 bg-primary/10 text-primary",
};

function copyLink(link: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(link);
  }
}

function printTableQr(table: RestaurantTable, unitName: string) {
  if (typeof window === "undefined") return;
  const qr = document.querySelector(`[data-table-qr="${table.id}"] svg`)?.outerHTML;
  const printWindow = window.open("", "_blank", "width=520,height=720");
  if (!printWindow) return;
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>QR Code Mesa ${String(table.number).padStart(2, "0")}</title>
        <style>
          body { margin: 0; font-family: Arial, sans-serif; color: #111; }
          main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px; box-sizing: border-box; }
          section { width: 100%; max-width: 420px; text-align: center; border: 3px solid #111; padding: 28px; }
          h1 { margin: 0; font-size: 28px; text-transform: uppercase; }
          h2 { margin: 12px 0 22px; font-size: 42px; }
          .qr { display: inline-flex; padding: 16px; border: 2px solid #111; }
          p { margin: 22px 0 8px; font-size: 18px; font-weight: 700; }
          small { overflow-wrap: anywhere; color: #555; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <main>
          <section>
            <h1>${unitName}</h1>
            <h2>Mesa ${String(table.number).padStart(2, "0")}</h2>
            <div class="qr">${qr ?? ""}</div>
            <p>Escaneie para fazer seu pedido</p>
            <small>${table.publicUrl}</small>
          </section>
        </main>
        <script>window.print();</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function MesasPage() {
  const { tables, selectedUnit, addTable, toggleTable, deleteTable } = useAdmin();
  const [busyTableId, setBusyTableId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null);
  const sorted = [...tables].sort((a, b) => a.number - b.number);
  const nextNumber = sorted.length ? Math.max(...sorted.map((table) => table.number)) + 1 : 1;

  return (
    <div>
      <PageHeader
        title="Mesas"
        subtitle={`Mesas, links e QR Codes · ${selectedUnit?.name ?? "Unidade"}`}
        action={
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground"
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              try {
                await addTable();
                toast.success("Mesa criada com sucesso.");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Não foi possível criar mesa.",
                );
              } finally {
                setCreating(false);
              }
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Criando..." : `Criar mesa ${String(nextNumber).padStart(2, "0")}`}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map((table) => (
          <div
            key={table.id}
            className={`rounded-xl border border-border bg-card p-5 ${table.active ? "" : "opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-black">Mesa {String(table.number).padStart(2, "0")}</p>
                <span
                  className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[table.status]}`}
                >
                  {TABLE_STATUS_LABELS[table.status]}
                </span>
              </div>
              <button
                disabled={busyTableId === table.id}
                onClick={async () => {
                  setBusyTableId(table.id);
                  try {
                    await toggleTable(table.id);
                    toast.success("Mesa atualizada com sucesso.");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Não foi possível atualizar mesa.",
                    );
                  } finally {
                    setBusyTableId(null);
                  }
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                  table.active
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {table.active ? "Ativa" : "Inativa"}
              </button>
            </div>

            <div
              data-table-qr={table.id}
              className="mx-auto my-5 flex w-fit rounded-lg border border-border bg-white p-3"
            >
              <QRCodeSVG
                value={table.qrCodeData || table.publicUrl}
                size={132}
                level="M"
                includeMargin={false}
              />
            </div>

            <p
              className="truncate rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground"
              title={table.publicUrl}
            >
              {table.publicUrl}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => copyLink(table.publicUrl)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </button>
              <button
                onClick={() => printTableQr(table, selectedUnit?.name ?? "Maximus")}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir QR
              </button>
              <button
                disabled={busyTableId === table.id}
                onClick={() => setTableToDelete(table)}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Apagar mesa
              </button>
            </div>
          </div>
        ))}
      </div>

      {tableToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="admin-root w-full max-w-md rounded-xl border border-border bg-card p-6 font-sora shadow-xl">
            <h2 className="text-xl font-black">Apagar mesa</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A Mesa {String(tableToDelete.number).padStart(2, "0")} será apagada se nunca foi usada
              em pedidos. Se houver histórico, ela será arquivada e não voltará após atualizar a
              página.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busyTableId === tableToDelete.id}
                onClick={() => setTableToDelete(null)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyTableId === tableToDelete.id}
                onClick={async () => {
                  setBusyTableId(tableToDelete.id);
                  try {
                    await deleteTable(tableToDelete.id);
                    toast.success("Mesa apagada com sucesso.");
                    setTableToDelete(null);
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Não foi possível apagar mesa.",
                    );
                  } finally {
                    setBusyTableId(null);
                  }
                }}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyTableId === tableToDelete.id ? "Apagando..." : "Apagar mesa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
