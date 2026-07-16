import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  Plus,
  Printer,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import { TABLE_STATUS_LABELS } from "@/admin/data/tables";
import type { RestaurantTable, TableStatus } from "@/admin/data/types";
import { desktopPrintHtml } from "@/admin/printing";
import { buildTablePublicUrl, normalizePublicAppUrl } from "@/admin/supabase-data";
import { useAdmin } from "@/admin/store";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getSupabaseClient } from "@/lib/supabase";

export const Route = createFileRoute("/admin/mesas")({
  component: MesasPage,
});

const STATUS_STYLE: Record<TableStatus, string> = {
  livre: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  ocupada: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  pedido_ativo: "border-primary/40 bg-primary/10 text-primary",
};

type AdminTableSnapshot = {
  tableId: string;
  tableNumber: string;
  statusLabel: string;
  customerName?: string;
  waiterName?: string;
  total: number;
  orderCount: number;
  lastOrderStatus?: string;
  activeSessionId?: string;
  raw: Record<string, unknown>;
};

type AdminTableSessionDetail = {
  sessionId: string;
  tableId: string;
  tableNumber: string;
  statusLabel: string;
  customerName?: string;
  waiterName?: string;
  openedAt?: string;
  total: number;
  orderCount: number;
  notes?: string;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    notes?: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      totalPrice?: number;
      notes?: string;
    }>;
  }>;
  events: Array<Record<string, unknown>>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function pickFirst(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (source[key] != null) return source[key];
  }
  return undefined;
}

function stringValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeTableNumber(value: unknown) {
  const raw = stringValue(value) ?? "-";
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? String(numeric).padStart(2, "0") : raw;
}

function normalizeStatusLabel(status?: string | null) {
  const key = status?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
  const labels: Record<string, string> = {
    livre: "Livre",
    free: "Livre",
    ocupada: "Ocupada",
    occupied: "Ocupada",
    pedido_ativo: "Ocupada",
    received: "Em preparo",
    accepted: "Em preparo",
    in_preparation: "Em preparo",
    ready: "Pronto",
    ready_for_pickup: "Pronto",
    billed: "Conta solicitada",
    closed: "Livre",
  };
  return labels[key] ?? (status ? status.replaceAll("_", " ") : "Livre");
}

function readWaiterName(source: Record<string, unknown>) {
  const openedBy = asRecord(pickFirst(source, ["opened_by", "waiter", "openedBy"]));
  return (
    stringValue(pickFirst(source, ["opened_by_name", "waiter_name"])) ??
    stringValue(pickFirst(openedBy, ["name", "full_name"]))
  );
}

function mapSnapshotRow(rowValue: unknown): AdminTableSnapshot {
  const row = asRecord(rowValue);
  const session = asRecord(
    pickFirst(row, ["session", "active_session", "table_session", "current_session"]),
  );
  const table = asRecord(pickFirst(row, ["table", "store_table"]));
  const orders = asArray(
    pickFirst(row, ["orders", "latest_orders"]) ?? pickFirst(session, ["orders"]),
  );
  const lastOrderStatusRaw =
    stringValue(
      pickFirst(row, ["last_order_status", "latest_order_status"]) ??
        pickFirst(session, ["last_order_status"]) ??
        asRecord(orders[0]).status,
    ) ?? undefined;
  return {
    tableId:
      stringValue(pickFirst(row, ["table_id"])) ?? stringValue(pickFirst(table, ["id"])) ?? "",
    tableNumber: normalizeTableNumber(
      pickFirst(row, ["table_number", "number"]) ?? pickFirst(table, ["table_number", "number"]),
    ),
    statusLabel: normalizeStatusLabel(
      stringValue(pickFirst(row, ["status", "table_status", "session_status"])) ??
        lastOrderStatusRaw,
    ),
    customerName:
      stringValue(
        pickFirst(row, ["customer_name"]) ??
          pickFirst(session, ["customer_name"]) ??
          pickFirst(asRecord(session.customer), ["name"]),
      ) ?? undefined,
    waiterName: readWaiterName(session) ?? readWaiterName(row) ?? undefined,
    total: numberValue(
      pickFirst(row, ["total", "session_total", "current_total"]) ??
        pickFirst(session, ["total", "subtotal"]),
    ),
    orderCount: Math.max(
      0,
      numberValue(pickFirst(row, ["order_count", "orders_count", "pedido_count"]) ?? orders.length),
    ),
    lastOrderStatus: normalizeStatusLabel(lastOrderStatusRaw),
    activeSessionId:
      stringValue(pickFirst(row, ["table_session_id", "session_id", "active_session_id"])) ??
      stringValue(pickFirst(session, ["id"])) ??
      undefined,
    raw: row,
  };
}

function mapSessionDetail(value: unknown): AdminTableSessionDetail {
  const response = asRecord(value);
  const session = asRecord(pickFirst(response, ["session", "data", "table_session"])) || response;
  const table = asRecord(pickFirst(session, ["table", "store_table"]));
  const orders = asArray(
    pickFirst(response, ["orders"]) ?? pickFirst(session, ["orders", "session_orders"]),
  );
  const events = asArray(
    pickFirst(response, ["events", "logs", "history"]) ?? pickFirst(session, ["events", "logs"]),
  ).map(asRecord);

  const normalizedOrders = orders.map((orderValue) => {
    const order = asRecord(orderValue);
    const items = asArray(
      pickFirst(order, ["items", "order_items", "itens", "products", "lines"]),
    ).map((itemValue) => {
      const item = asRecord(itemValue);
      return {
        id: stringValue(pickFirst(item, ["id", "item_id"])) ?? crypto.randomUUID(),
        name: stringValue(pickFirst(item, ["product_name", "name", "title"])) ?? "Item",
        quantity: Math.max(1, numberValue(pickFirst(item, ["quantity", "qty"]))),
        totalPrice: numberValue(pickFirst(item, ["total_price", "total"])) || undefined,
        notes: stringValue(pickFirst(item, ["notes", "observation"])) ?? undefined,
      };
    });
    return {
      id: stringValue(pickFirst(order, ["id", "order_id"])) ?? crypto.randomUUID(),
      orderNumber:
        stringValue(pickFirst(order, ["order_number", "number", "code"])) ??
        `#${items.length || 1}`,
      status: normalizeStatusLabel(stringValue(pickFirst(order, ["status", "state"]))),
      total: numberValue(pickFirst(order, ["total", "order_total", "subtotal"])),
      notes: stringValue(pickFirst(order, ["notes", "observation"])) ?? undefined,
      items,
    };
  });

  return {
    sessionId: stringValue(pickFirst(session, ["id", "session_id"])) ?? "",
    tableId:
      stringValue(pickFirst(session, ["table_id"])) ?? stringValue(pickFirst(table, ["id"])) ?? "",
    tableNumber: normalizeTableNumber(
      pickFirst(session, ["table_number"]) ?? pickFirst(table, ["table_number", "number"]),
    ),
    statusLabel: normalizeStatusLabel(
      stringValue(pickFirst(session, ["status", "state", "session_status"])),
    ),
    customerName:
      stringValue(pickFirst(session, ["customer_name"])) ??
      stringValue(pickFirst(asRecord(session.customer), ["name"])) ??
      undefined,
    waiterName: readWaiterName(session) ?? readWaiterName(response) ?? undefined,
    openedAt:
      stringValue(pickFirst(session, ["opened_at", "created_at", "started_at"])) ?? undefined,
    total: numberValue(
      pickFirst(session, ["total", "session_total", "amount_total"]) ??
        pickFirst(response, ["total"]),
    ),
    orderCount: normalizedOrders.length,
    notes: stringValue(pickFirst(session, ["notes", "observation"])) ?? undefined,
    orders: normalizedOrders,
    events,
  };
}

async function getUnitDbIdBySlug(unitSlug: string) {
  const { data, error } = await getSupabaseClient()
    .from("units")
    .select("id")
    .eq("slug", unitSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Unidade não encontrada para carregar as mesas.");
  return data.id as string;
}

async function listAdminTableSnapshots(unitSlug: string) {
  const unitDbId = await getUnitDbIdBySlug(unitSlug);
  const { data, error } = await getSupabaseClient().rpc("list_table_sessions_snapshot", {
    p_unit_id: unitDbId,
  });
  if (error) throw new Error(error.message);
  return asArray(data).map(mapSnapshotRow);
}

async function getAdminSessionDetail(sessionId: string) {
  const { data, error } = await getSupabaseClient().rpc("get_table_session_detail", {
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
  return mapSessionDetail(data);
}

async function getAdminActiveSessionByTable(tableId: string) {
  const { data, error } = await getSupabaseClient().rpc(
    "get_active_table_session_detail_by_table",
    {
      p_table_id: tableId,
    },
  );
  if (error) throw new Error(error.message);
  return data ? mapSessionDetail(data) : null;
}

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
  const [snapshots, setSnapshots] = useState<Record<string, AdminTableSnapshot>>({});
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [selectedTableDetail, setSelectedTableDetail] = useState<AdminTableSessionDetail | null>(
    null,
  );
  const [loadingPanel, setLoadingPanel] = useState(false);
  const sorted = [...tables].sort((a, b) => a.number - b.number);
  const activeTables = sorted.filter((table) => table.active);
  const nextNumber = activeTables.length
    ? Math.max(...activeTables.map((table) => table.number)) + 1
    : 1;
  const publicAppUrl = normalizePublicAppUrl(selectedUnit?.publicAppUrl);
  const hasDevPublicAppUrlFallback = !publicAppUrl && Boolean(devPublicAppUrlFallback());

  const refreshSnapshots = useCallback(async () => {
    if (!selectedUnit?.id) return;
    setLoadingSnapshots(true);
    try {
      const nextSnapshots = await listAdminTableSnapshots(selectedUnit.id);
      setSnapshots(Object.fromEntries(nextSnapshots.map((item) => [item.tableId, item])));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível carregar o painel operacional.",
      );
    } finally {
      setLoadingSnapshots(false);
    }
  }, [selectedUnit?.id]);

  useEffect(() => {
    if (!selectedUnit?.id) return;
    void refreshSnapshots();
  }, [refreshSnapshots, selectedUnit?.id, tables.length]);

  async function openTablePanel(table: RestaurantTable) {
    setSelectedTable(table);
    setSelectedTableDetail(null);
    setLoadingPanel(true);
    try {
      const snapshot = snapshots[table.id];
      if (snapshot?.activeSessionId) {
        const detail = await getAdminSessionDetail(snapshot.activeSessionId);
        setSelectedTableDetail(detail);
      } else {
        const detail = await getAdminActiveSessionByTable(table.id);
        setSelectedTableDetail(detail);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível carregar os dados da mesa.",
      );
    } finally {
      setLoadingPanel(false);
    }
  }

  const visibleTables = useMemo(
    () =>
      sorted.map((table) => ({
        table,
        snapshot: snapshots[table.id] ?? null,
      })),
    [snapshots, sorted],
  );

  return (
    <div>
      <PageHeader
        title="Mesas"
        subtitle={selectedUnit?.name ?? "Unidade"}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshSnapshots()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-secondary px-4 text-sm font-extrabold"
            >
              <RefreshCcw className={`h-4 w-4 ${loadingSnapshots ? "animate-spin" : ""}`} />
              Atualizar
            </button>
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
          </div>
        }
      />

      {!publicAppUrl && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-extrabold">Configure a URL pública do sistema.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Preencha a URL pública em Configurações &gt; Sistema.
              {hasDevPublicAppUrlFallback
                ? " Em desenvolvimento, será usado o endereço local atual como fallback."
                : ""}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleTables.map(({ table, snapshot }) => {
          const tableUrl = buildTablePublicUrl(
            selectedUnit?.publicAppUrl,
            selectedUnit?.id ?? table.unitId,
            table.number,
          );
          const displayUrl = tableUrl || "Configure public_app_url para gerar o QR Code.";
          const statusText = snapshot?.statusLabel ?? TABLE_STATUS_LABELS[table.status];
          return (
            <div
              key={table.id}
              role="button"
              tabIndex={0}
              onClick={() => void openTablePanel(table)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void openTablePanel(table);
                }
              }}
              className={`rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary ${
                table.active ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black">Mesa {String(table.number).padStart(2, "0")}</p>
                  <span
                    className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${
                      STATUS_STYLE[table.status]
                    }`}
                  >
                    {statusText}
                  </span>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Cliente: {snapshot?.customerName ?? "Sem comanda ativa"}</p>
                    <p>Garçom: {snapshot?.waiterName ?? "Sem responsável"}</p>
                    <p>Total: {snapshot?.total ? formatBRL(snapshot.total) : "-"}</p>
                    <p>Pedidos: {snapshot?.orderCount ?? 0}</p>
                    <p>Último status: {snapshot?.lastOrderStatus ?? "-"}</p>
                  </div>
                </div>
                <button
                  disabled={busyTableId === table.id}
                  onClick={async (event) => {
                    event.stopPropagation();
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
                  onClick={(event) => {
                    event.stopPropagation();
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
                  onClick={(event) => {
                    event.stopPropagation();
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
                  onClick={(event) => {
                    event.stopPropagation();
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
                  onClick={(event) => {
                    event.stopPropagation();
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
                  onClick={(event) => {
                    event.stopPropagation();
                    setTableToDelete(table);
                  }}
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

      <Sheet open={Boolean(selectedTable)} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {selectedTable ? `Mesa ${String(selectedTable.number).padStart(2, "0")}` : "Mesa"}
            </SheetTitle>
            <SheetDescription>Consulta operacional da mesa selecionada.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {loadingPanel ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Carregando dados da mesa...
              </div>
            ) : !selectedTableDetail ? (
              <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                <DetailLine label="Status atual" value="Livre" />
                <DetailLine label="Situação" value="Sem comanda ativa" />
                <DetailLine label="Cliente" value="Sem cliente vinculado" />
                <DetailLine label="Garçom" value="Sem garçom responsável" />
              </div>
            ) : (
              <>
                <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                  <DetailLine label="Status atual" value={selectedTableDetail.statusLabel} />
                  <DetailLine label="Situação" value="Ocupada" />
                  <DetailLine label="Cliente" value={selectedTableDetail.customerName ?? "-"} />
                  <DetailLine label="Garçom" value={selectedTableDetail.waiterName ?? "-"} />
                  <DetailLine
                    label="ID da comanda"
                    value={selectedTableDetail.sessionId.slice(0, 8)}
                  />
                  <DetailLine
                    label="Horário de abertura"
                    value={
                      selectedTableDetail.openedAt
                        ? formatDateTime(selectedTableDetail.openedAt)
                        : "-"
                    }
                  />
                  <DetailLine label="Total atual" value={formatBRL(selectedTableDetail.total)} />
                  <DetailLine
                    label="Quantidade de pedidos"
                    value={String(selectedTableDetail.orderCount)}
                  />
                  <DetailLine label="Observações" value={selectedTableDetail.notes ?? "-"} />
                </div>

                <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-primary">
                    Pedidos da comanda
                  </p>
                  {selectedTableDetail.orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem pedidos registrados.</p>
                  ) : (
                    selectedTableDetail.orders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">Pedido {order.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">{order.status}</p>
                          </div>
                          <span className="text-sm font-bold">{formatBRL(order.total)}</span>
                        </div>
                        {order.notes && (
                          <p className="mt-2 text-sm text-muted-foreground">{order.notes}</p>
                        )}
                        <div className="mt-3 space-y-2">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-md border border-border px-3 py-2 text-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p>
                                    {item.quantity}x {item.name}
                                  </p>
                                  {item.notes && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>
                                <span>{item.totalPrice ? formatBRL(item.totalPrice) : "-"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {selectedTableDetail.events.length > 0 && (
                  <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-extrabold uppercase tracking-wide text-primary">
                      Eventos / log
                    </p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {selectedTableDetail.events.map((event, index) => (
                        <pre
                          key={`${index}-${JSON.stringify(event).slice(0, 12)}`}
                          className="overflow-x-auto rounded-md border border-border bg-background p-3 whitespace-pre-wrap"
                        >
                          {JSON.stringify(event, null, 2)}
                        </pre>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {tableToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="admin-root w-full max-w-md rounded-lg border border-border bg-card p-5 font-sora">
            <h2 className="text-lg font-black">Apagar mesa</h2>
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

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
