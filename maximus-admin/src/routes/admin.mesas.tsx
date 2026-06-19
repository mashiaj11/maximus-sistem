import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Copy, Download, ExternalLink, Plus, Printer, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import { TABLE_STATUS_LABELS } from "@/admin/data/tables";
import type { RestaurantTable, TableStatus } from "@/admin/data/types";
import { desktopPrintHtml } from "@/admin/printing";
import { buildTablePublicUrl, normalizePublicAppUrl } from "@/admin/supabase-data";
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

function devPublicAppUrlFallback() {
  if (!import.meta.env.DEV || typeof window === "undefined") return "";
  return window.location.origin;
}

function downloadTableQr(table: RestaurantTable) {
  if (typeof window === "undefined") return;
  const svg = document.querySelector(`[data-table-qr="${table.id}"] svg`)?.outerHTML;
  if (!svg) {
    toast.error("QR Code indisponível para download.");
    return;
  }
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `maximus-mesa-${String(table.number).padStart(2, "0")}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function printTableQr(table: RestaurantTable, unitName: string, tableUrl: string) {
  if (typeof window === "undefined") return;
  const qr = document.querySelector(`[data-table-qr="${table.id}"] svg`)?.outerHTML;
  const html = `
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
            <small>${tableUrl}</small>
          </section>
        </main>
        <script>window.print();</script>
      </body>
    </html>
  `;
  const settings = await window.maximusDesktop?.getPrintSettings();
  const printer =
    settings?.printers.find(
      (item) => item.unitId === table.unitId && item.destination === "cashier" && item.enabled,
    ) ??
    settings?.printers.find((item) => item.unitId === table.unitId && item.enabled) ??
    undefined;
  const result = await desktopPrintHtml(html, printer, {
    tableId: table.id,
    tableNumber: table.number,
    destination: printer?.destination ?? "cashier",
    unitId: table.unitId,
    manual: true,
  });
  if (!result.ok) throw new Error(result.error ?? "Não foi possível imprimir o QR Code.");
}

function MesasPage() {
  const { tables, selectedUnit, addTable, toggleTable, deleteTable } = useAdmin();
  const [busyTableId, setBusyTableId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null);
  const sorted = [...tables].sort((a, b) => a.number - b.number);
  const activeTables = sorted.filter((table) => table.active);
  const nextNumber = activeTables.length
    ? Math.max(...activeTables.map((table) => table.number)) + 1
    : 1;
  const publicAppUrl = normalizePublicAppUrl(selectedUnit?.publicAppUrl);
  const hasDevPublicAppUrlFallback = !publicAppUrl && Boolean(devPublicAppUrlFallback());

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

      {!publicAppUrl && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-extrabold">Configure a URL pública do sistema.</p>
            <p className="mt-1 text-amber-100/80">
              Acesse Configurações &gt; Sistema e preencha public_app_url para gerar links completos
              e QR Codes de mesa.
              {hasDevPublicAppUrlFallback
                ? " Em desenvolvimento, será usado o endereço local atual como fallback."
                : ""}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map((table) => {
          const tableUrl = buildTablePublicUrl(
            selectedUnit?.publicAppUrl,
            selectedUnit?.id ?? table.unitId,
            table.number,
          );
          console.log("TABLE ROW", table);
          console.log("GENERATED TABLE URL", tableUrl);
          console.log("QR VALUE", tableUrl);
          const displayUrl = tableUrl || "Configure public_app_url para gerar o QR Code.";
          return (
            <div
              key={table.id}
              className={`rounded-xl border border-border bg-card p-5 ${table.active ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-black">
                    Mesa {String(table.number).padStart(2, "0")}
                  </p>
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

              {tableUrl ? (
                <div
                  data-table-qr={table.id}
                  className="mx-auto my-5 flex w-fit rounded-lg border border-border bg-white p-3"
                >
                  <QRCodeSVG value={tableUrl} size={132} level="M" includeMargin={false} />
                </div>
              ) : (
                <div className="mx-auto my-5 flex h-[158px] w-[158px] items-center justify-center rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs font-bold text-amber-200">
                  Configure public_app_url
                </div>
              )}

              <p
                className="truncate rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground"
                title={displayUrl}
              >
                {displayUrl}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (!tableUrl) {
                      toast.error("Configure a URL pública do sistema antes de copiar o link.");
                      return;
                    }
                    copyLink(tableUrl);
                    toast.success("Link copiado.");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar link
                </button>
                <button
                  onClick={() => {
                    if (!tableUrl) {
                      toast.error("Configure a URL pública do sistema antes de abrir o link.");
                      return;
                    }
                    window.open(tableUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir link
                </button>
                <button
                  onClick={() => {
                    if (!tableUrl) {
                      toast.error("Configure a URL pública do sistema antes de imprimir o QR.");
                      return;
                    }
                    printTableQr(table, selectedUnit?.name ?? "Maximus", tableUrl).catch(
                      (error) => {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Não foi possível imprimir o QR Code.",
                        );
                      },
                    );
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir QR
                </button>
                <button
                  onClick={() => {
                    if (!tableUrl) {
                      toast.error("Configure a URL pública do sistema antes de baixar o QR.");
                      return;
                    }
                    downloadTableQr(table);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar QR
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
          );
        })}
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
