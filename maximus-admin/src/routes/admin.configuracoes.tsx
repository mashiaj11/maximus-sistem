import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Copy,
  FolderOpen,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import type {
  AdminUnit,
  BusinessHour,
  KitchenPrintSettings,
  UnitTheme,
  WeekdayKey,
  WhatsappMessageSettings,
  WhatsappSendMode,
  WhatsappStatusSettings,
  WhatsappStatusMessages,
} from "@/admin/data/types";
import { useAdmin } from "@/admin/store";

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfiguracoesPage,
});

const DAY_LABELS: Record<WeekdayKey, string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
};

const DEFAULT_KITCHEN_PRINT_SETTINGS: KitchenPrintSettings = {
  autoPrintEnabled: false,
  printerName: "Cozinha",
  printerIp: "",
  printerPort: 9100,
  printerType: "escpos",
  copies: 1,
};

const DEFAULT_WHATSAPP_SETTINGS: WhatsappMessageSettings = {
  enabled: false,
  botEnabled: false,
  officialNumber: "",
  welcomeMessage: "",
  humanMessage: "",
  received: "",
  accepted: "",
  in_preparation: "",
  ready: "",
  ready_for_pickup: "",
  out_for_delivery: "",
  driver_on_way: "",
  driver_nearby: "",
  arrived: "",
  delivered: "",
  picked_up: "",
  delivered_to_table: "",
  cancelled: "",
};

const WHATSAPP_FIELDS: Array<{ key: keyof WhatsappStatusMessages; label: string }> = [
  { key: "received", label: "Pedido recebido" },
  { key: "accepted", label: "Pedido aceito" },
  { key: "in_preparation", label: "Pedido em preparação" },
  { key: "ready", label: "Pedido pronto" },
  { key: "ready_for_pickup", label: "Pronto para retirada" },
  { key: "out_for_delivery", label: "Saiu para entrega" },
  { key: "driver_on_way", label: "Entregador a caminho" },
  { key: "driver_nearby", label: "Entregador próximo" },
  { key: "arrived", label: "Entregador chegou" },
  { key: "delivered", label: "Pedido entregue" },
  { key: "picked_up", label: "Pedido retirado" },
  { key: "delivered_to_table", label: "Entregue à mesa" },
  { key: "cancelled", label: "Pedido cancelado" },
];

const WHATSAPP_SEND_MODE_LABELS: Record<WhatsappSendMode, string> = {
  text: "Somente texto",
  pdf: "Somente comprovante PDF",
  text_and_pdf: "Texto + comprovante PDF",
};

const WHATSAPP_STATUS_CARD_COLORS = [
  "border-orange-500/30 bg-orange-500/10",
  "border-blue-500/30 bg-blue-500/10",
  "border-emerald-500/30 bg-emerald-500/10",
  "border-amber-500/30 bg-amber-500/10",
  "border-cyan-500/30 bg-cyan-500/10",
  "border-violet-500/30 bg-violet-500/10",
  "border-pink-500/30 bg-pink-500/10",
  "border-lime-500/30 bg-lime-500/10",
  "border-red-500/30 bg-red-500/10",
];

const TEST_PRINT_HTML =
  "<html><body><main style='font-family:Arial;padding:8px'><h1>MAXIMUS</h1><p>Teste de impressão nativa</p></main></body></html>";

const CONNECTION_MODE_LABELS: Record<
  NonNullable<MaximusPrinterConfig["connectionMode"]>,
  string
> = {
  system: "Impressora instalada no sistema",
  network: "Impressora de rede direta",
};

const NETWORK_PROTOCOL_LABELS: Record<
  NonNullable<MaximusPrinterConfig["networkProtocol"]>,
  string
> = {
  raw: "RAW 9100",
  escpos: "ESC/POS",
};

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function validateBusinessHours(hours: BusinessHour[]) {
  const errors: string[] = [];
  for (const hour of hours) {
    if (!hour.open) continue;
    const periods = hour.periods
      .map((period) => ({
        opensAt: period.opensAt,
        closesAt: period.closesAt,
        start: timeToMinutes(period.opensAt),
        end: timeToMinutes(period.closesAt),
      }))
      .sort((a, b) => a.start - b.start);
    for (const period of periods) {
      if (!period.opensAt || !period.closesAt || period.start === period.end) {
        errors.push(`${DAY_LABELS[hour.day]} tem intervalo inválido.`);
      }
    }
    for (let index = 1; index < periods.length; index += 1) {
      if (periods[index].start < periods[index - 1].end) {
        errors.push(`${DAY_LABELS[hour.day]} tem horários sobrepostos.`);
      }
    }
  }
  return errors;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePhoneInput(value: string) {
  return onlyDigits(value).slice(0, 13);
}

function buildWhatsAppLink(phone: string) {
  const clean = onlyDigits(phone);
  if (!clean) return "";
  const withCountry = clean.startsWith("55") ? clean : `55${clean}`;
  return `https://wa.me/${withCountry}`;
}

function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard && text) {
    navigator.clipboard.writeText(text);
  }
}

function normalizePrinterConfig(printer: MaximusPrinterConfig): MaximusPrinterConfig {
  const connectionMode = printer.connectionMode ?? "system";
  return {
    ...printer,
    connectionMode,
    networkPort: Math.max(1, Number(printer.networkPort ?? 9100)),
    networkProtocol: printer.networkProtocol ?? "raw",
  };
}

function normalizePrintSettings(settings: MaximusPrintSettings): MaximusPrintSettings {
  return {
    version: settings.version || 1,
    printers: Array.isArray(settings.printers)
      ? settings.printers.map((printer) => normalizePrinterConfig(printer))
      : [],
  };
}

function getPrinterStatus(
  printer: MaximusPrinterConfig,
  detectedPrinters: Array<{
    name: string;
    displayName?: string;
    status?: number;
    isDefault?: boolean;
  }>,
) {
  if (!printer.enabled) return { label: "desativada", className: "bg-muted text-muted-foreground" };
  if (printer.simulate) return { label: "pronta", className: "bg-emerald-500/15 text-emerald-300" };
  if ((printer.connectionMode ?? "system") === "network") {
    return { label: "erro", className: "bg-destructive/15 text-destructive" };
  }
  if (!printer.deviceName)
    return { label: "erro", className: "bg-destructive/15 text-destructive" };
  const detected = detectedPrinters.some((item) => item.name === printer.deviceName);
  return detected
    ? { label: "pronta", className: "bg-emerald-500/15 text-emerald-300" }
    : { label: "não encontrada", className: "bg-amber-500/15 text-amber-200" };
}

function normalizeWhatsappSettings(
  settings: WhatsappMessageSettings | undefined,
): WhatsappMessageSettings {
  const messages: WhatsappStatusMessages = {
    received: settings?.received ?? DEFAULT_WHATSAPP_SETTINGS.received ?? "",
    accepted: settings?.accepted ?? DEFAULT_WHATSAPP_SETTINGS.accepted ?? "",
    in_preparation: settings?.in_preparation ?? DEFAULT_WHATSAPP_SETTINGS.in_preparation ?? "",
    ready: settings?.ready ?? DEFAULT_WHATSAPP_SETTINGS.ready ?? "",
    ready_for_pickup:
      settings?.ready_for_pickup ?? DEFAULT_WHATSAPP_SETTINGS.ready_for_pickup ?? "",
    out_for_delivery:
      settings?.out_for_delivery ?? DEFAULT_WHATSAPP_SETTINGS.out_for_delivery ?? "",
    driver_on_way: settings?.driver_on_way ?? DEFAULT_WHATSAPP_SETTINGS.driver_on_way ?? "",
    driver_nearby: settings?.driver_nearby ?? DEFAULT_WHATSAPP_SETTINGS.driver_nearby ?? "",
    arrived: settings?.arrived ?? DEFAULT_WHATSAPP_SETTINGS.arrived ?? "",
    delivered: settings?.delivered ?? DEFAULT_WHATSAPP_SETTINGS.delivered ?? "",
    picked_up: settings?.picked_up ?? DEFAULT_WHATSAPP_SETTINGS.picked_up ?? "",
    delivered_to_table:
      settings?.delivered_to_table ?? DEFAULT_WHATSAPP_SETTINGS.delivered_to_table ?? "",
    cancelled: settings?.cancelled ?? DEFAULT_WHATSAPP_SETTINGS.cancelled ?? "",
  };
  const statusSettings = WHATSAPP_FIELDS.reduce((acc, field) => {
    const saved = settings?.statusSettings?.[field.key];
    acc[field.key] = {
      enabled: saved?.enabled ?? true,
      mode: saved?.mode ?? "text",
      message: saved?.message ?? messages[field.key],
    };
    return acc;
  }, {} as WhatsappStatusSettings);

  return {
    enabled: Boolean(settings?.enabled),
    botEnabled: Boolean(settings?.botEnabled),
    officialNumber: settings?.officialNumber ?? "",
    welcomeMessage: settings?.welcomeMessage ?? DEFAULT_WHATSAPP_SETTINGS.welcomeMessage,
    humanMessage: settings?.humanMessage ?? DEFAULT_WHATSAPP_SETTINGS.humanMessage,
    ...messages,
    statusSettings,
  };
}

function ConfiguracoesPage() {
  const { selectedUnit, units, updateUnit, resetOperationalData } = useAdmin();
  const [draft, setDraft] = useState<AdminUnit | null>(selectedUnit);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [detectedPrinters, setDetectedPrinters] = useState<
    Array<{ name: string; displayName?: string; status?: number; isDefault?: boolean }>
  >([]);
  const [localPrintSettings, setLocalPrintSettings] = useState<MaximusPrintSettings>({
    version: 1,
    printers: [],
  });
  const [nativePrintStatus, setNativePrintStatus] = useState<string>("");
  const selectedUnitRef = useRef(selectedUnit);
  const selectedUnitId = selectedUnit?.id;
  const isDesktop = typeof window !== "undefined" && Boolean(window.maximusDesktop?.isElectron);

  useEffect(() => {
    selectedUnitRef.current = selectedUnit;
  }, [selectedUnit]);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    async function loadDesktopPrinting() {
      try {
        const [printersResult, settings] = await Promise.all([
          window.maximusDesktop!.listPrinters(),
          window.maximusDesktop!.getPrintSettings(),
        ]);
        if (cancelled) return;
        setDetectedPrinters(printersResult.printers ?? []);
        setLocalPrintSettings(normalizePrintSettings(settings));
      } catch (error) {
        console.error("[Maximus][print-config] Falha ao carregar impressoras", error);
        setNativePrintStatus("Falha ao carregar impressoras locais.");
      }
    }
    loadDesktopPrinting();
    return () => {
      cancelled = true;
    };
  }, [isDesktop]);

  useEffect(() => {
    const unit = selectedUnitRef.current;
    console.info("[Maximus][config][business-hours] horários carregados", {
      unitId: unit?.id ?? null,
      businessHours: unit?.businessHours ?? null,
    });
    setDraft(unit ?? null);
    setSaveStatus("idle");
  }, [selectedUnitId]);

  const whatsappSettings = normalizeWhatsappSettings(draft?.whatsappSettings);
  const whatsAppLink = useMemo(
    () => buildWhatsAppLink(whatsappSettings.officialNumber || draft?.phone || ""),
    [draft?.phone, whatsappSettings.officialNumber],
  );

  if (!draft || draft.id !== selectedUnit?.id) return null;

  function markDirty() {
    setSaveStatus("idle");
  }

  function updateBusinessHours(nextBusinessHours: BusinessHour[]) {
    if (!draft) return;
    console.info("[Maximus][config][business-hours] horários antes de editar", {
      unitId: draft.id,
      businessHours: draft.businessHours,
    });
    console.info("[Maximus][config][business-hours] horários depois de editar", {
      unitId: draft.id,
      businessHours: nextBusinessHours,
    });
    setDraft({
      ...draft,
      businessHours: nextBusinessHours,
    });
    markDirty();
  }

  function updateHour(day: WeekdayKey, patch: Partial<BusinessHour>) {
    if (!draft) return;
    updateBusinessHours(
      draft.businessHours.map((hour) => (hour.day === day ? { ...hour, ...patch } : hour)),
    );
  }

  function updatePeriod(
    day: WeekdayKey,
    index: number,
    key: "opensAt" | "closesAt",
    value: string,
  ) {
    if (!draft) return;
    updateBusinessHours(
      draft.businessHours.map((hour) =>
        hour.day === day
          ? {
              ...hour,
              periods: hour.periods.map((period, periodIndex) =>
                periodIndex === index ? { ...period, [key]: value } : period,
              ),
            }
          : hour,
      ),
    );
  }

  function addPeriod(day: WeekdayKey) {
    if (!draft) return;
    const periods = draft.businessHours.find((hour) => hour.day === day)?.periods ?? [];
    const lastPeriod = periods.at(-1);
    updateHour(day, {
      periods: [
        ...periods,
        {
          opensAt: lastPeriod?.closesAt ?? "",
          closesAt: "",
        },
      ],
    });
  }

  function removePeriod(day: WeekdayKey, index: number) {
    if (!draft) return;
    const hour = draft.businessHours.find((item) => item.day === day);
    if (!hour) return;
    updateHour(day, {
      periods: hour.periods.filter((_, periodIndex) => periodIndex !== index),
    });
  }

  const kitchenPrintSettings: KitchenPrintSettings = {
    ...DEFAULT_KITCHEN_PRINT_SETTINGS,
    ...draft.kitchenPrintSettings,
  };

  async function refreshNativePrinters() {
    if (!window.maximusDesktop) return;
    setNativePrintStatus("Atualizando impressoras...");
    const result = await window.maximusDesktop.listPrinters();
    setDetectedPrinters(result.printers ?? []);
    setNativePrintStatus(
      result.ok ? "Impressoras atualizadas." : (result.error ?? "Falha ao listar impressoras."),
    );
  }

  async function saveNativePrintSettings(next: MaximusPrintSettings) {
    const normalized = normalizePrintSettings(next);
    setLocalPrintSettings(normalized);
    if (!window.maximusDesktop) return;
    try {
      const saved = await window.maximusDesktop.savePrintSettings(normalized);
      setLocalPrintSettings(normalizePrintSettings(saved));
      setNativePrintStatus("Configuração local salva.");
    } catch (error) {
      console.error("[Maximus][print-config] Falha ao salvar configuração local", error);
      setNativePrintStatus("Falha ao salvar configuração local.");
    }
  }

  function updateNativePrinter(id: string, patch: Partial<MaximusPrinterConfig>) {
    const next = {
      ...localPrintSettings,
      printers: localPrintSettings.printers.map((printer) =>
        printer.id === id ? { ...printer, ...patch } : printer,
      ),
    };
    void saveNativePrintSettings(next);
  }

  function addNativePrinter() {
    const firstPrinter = detectedPrinters[0];
    const nextPrinter: MaximusPrinterConfig = {
      id: `printer-${Date.now()}`,
      name: firstPrinter?.displayName || firstPrinter?.name || "Impressora",
      deviceName: firstPrinter?.name ?? "",
      unitId: selectedUnit?.id ?? units[0]?.id ?? "",
      destination: "kitchen",
      connectionMode: "system",
      networkHost: kitchenPrintSettings.printerIp,
      networkPort: kitchenPrintSettings.printerPort,
      networkProtocol: "raw",
      enabled: true,
      autoPrint: true,
      paperWidth: 80,
      copies: 1,
      margin: 0,
      simulate: false,
    };
    void saveNativePrintSettings({
      ...localPrintSettings,
      printers: [...localPrintSettings.printers, nextPrinter],
    });
  }

  function removeNativePrinter(id: string) {
    void saveNativePrintSettings({
      ...localPrintSettings,
      printers: localPrintSettings.printers.filter((printer) => printer.id !== id),
    });
  }

  async function testNativePrinter(printer: MaximusPrinterConfig) {
    if (!window.maximusDesktop) return;
    setNativePrintStatus("Enviando teste...");
    const result = printer.simulate
      ? await window.maximusDesktop.printToPdf({
          deviceName: printer.deviceName,
          copies: printer.copies,
          paperWidth: printer.paperWidth,
          margin: printer.margin,
          destination: printer.destination,
          unitId: printer.unitId,
          html: TEST_PRINT_HTML,
        })
      : (printer.connectionMode ?? "system") === "network"
        ? {
            ok: false,
            error:
              "Impressão de rede direta ainda não está disponível neste aplicativo. Use uma impressora instalada no sistema.",
          }
        : await window.maximusDesktop.printTest({
            ...printer,
            html: TEST_PRINT_HTML,
          });
    setNativePrintStatus(
      result.ok
        ? result.file
          ? `PDF gerado: ${result.file}`
          : "Teste enviado."
        : (result.error ?? "Falha no teste."),
    );
  }

  function updateWhatsappSettings(patch: Partial<WhatsappMessageSettings>) {
    if (!draft) return;
    setDraft({
      ...draft,
      whatsappSettings: {
        ...whatsappSettings,
        ...patch,
      },
    });
    markDirty();
  }

  const hourErrors = validateBusinessHours(draft.businessHours);
  const canSave = saveStatus !== "saving" && hourErrors.length === 0;

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle={`Dados reais da unidade · ${selectedUnit?.name ?? "Unidade"}`}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="order-1 rounded-xl border border-orange-500/35 bg-orange-500/10 p-5">
          <h2 className="text-lg font-semibold text-orange-200">Unidade</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Nome da unidade</label>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Telefone da unidade
              </label>
              <input
                value={draft.phone}
                onChange={(event) =>
                  setDraft({ ...draft, phone: normalizePhoneInput(event.target.value) })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">
                Link público do WhatsApp
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={whatsAppLink}
                  className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm"
                />
                <button
                  onClick={() => copyText(whatsAppLink)}
                  className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 text-xs font-bold hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Este número é apenas o contato exibido no sistema. O número remetente depende da
                instância conectada à Evolution API.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Senha numérica local da unidade
              </label>
              <input
                value={draft.accessPin}
                onChange={(event) =>
                  setDraft({ ...draft, accessPin: onlyDigits(event.target.value).slice(0, 8) })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm tracking-widest"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Proteção simples para teste local. Não substitui Auth real.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Endereço da unidade
              </label>
              <textarea
                value={draft.address}
                onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={draft.latitude}
                  onChange={(event) => setDraft({ ...draft, latitude: Number(event.target.value) })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={draft.longitude}
                  onChange={(event) =>
                    setDraft({ ...draft, longitude: Number(event.target.value) })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-orange-500/25 bg-orange-500/10 p-3">
              <span>
                <span className="block text-sm font-bold">Unidade aberta para delivery</span>
                <span className="text-xs text-muted-foreground">
                  Unidades fechadas são ignoradas na escolha automática.
                </span>
              </span>
              <input
                type="checkbox"
                checked={draft.isOpen}
                onChange={(event) => {
                  setDraft({ ...draft, isOpen: event.target.checked });
                  markDirty();
                }}
                className="h-5 w-5 accent-primary"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["acceptsDelivery", "Aceita delivery"],
                ["acceptsPickup", "Aceita retirada"],
                ["acceptsDineIn", "Aceita consumo local"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-blue-500/25 bg-blue-500/10 p-3"
                >
                  <span className="text-sm font-bold">{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(draft[key as keyof AdminUnit] ?? true)}
                    onChange={(event) => {
                      setDraft({ ...draft, [key]: event.target.checked });
                      markDirty();
                    }}
                    className="h-5 w-5 accent-primary"
                  />
                </label>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Tema visual</label>
              <select
                value={draft.theme}
                onChange={(event) => {
                  setDraft({ ...draft, theme: event.target.value as UnitTheme });
                  markDirty();
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="dark">Dark</option>
                <option value="light">Claro</option>
              </select>
            </div>
          </div>
        </section>

        <section className="order-2 rounded-xl border border-blue-500/35 bg-blue-500/10 p-5">
          <h2 className="text-lg font-semibold text-blue-200">Sistema</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                URL pública do sistema
              </label>
              <input
                value={draft.publicAppUrl ?? ""}
                onChange={(event) => {
                  setDraft({ ...draft, publicAppUrl: event.target.value });
                  markDirty();
                }}
                placeholder="https://pedidos.seudominio.com.br"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Usada como base nos links e QR Codes das mesas. Exemplo:
                https://pedidos.seudominio.com.br
              </p>
            </div>
          </div>
        </section>

        <section className="order-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-5">
          <h2 className="text-lg font-semibold text-emerald-200">Funcionamento</h2>
          <div className="mt-4 space-y-3">
            {draft.businessHours.map((hour) => (
              <div
                key={hour.day}
                className="rounded-lg border border-emerald-500/25 bg-background/70 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-bold">{DAY_LABELS[hour.day]}</span>
                  <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={hour.open}
                      onChange={(event) => updateHour(hour.day, { open: event.target.checked })}
                      className="accent-primary"
                    />
                    Aberto
                  </label>
                </div>
                <div className="mt-3 space-y-2">
                  {hour.periods.map((period, index) => (
                    <div
                      key={`${hour.day}-${index}`}
                      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <input
                        type="time"
                        value={period.opensAt}
                        disabled={!hour.open}
                        onChange={(event) =>
                          updatePeriod(hour.day, index, "opensAt", event.target.value)
                        }
                        className="rounded-lg border border-input bg-card px-3 py-2 text-sm disabled:opacity-50"
                      />
                      <input
                        type="time"
                        value={period.closesAt}
                        disabled={!hour.open}
                        onChange={(event) =>
                          updatePeriod(hour.day, index, "closesAt", event.target.value)
                        }
                        className="rounded-lg border border-input bg-card px-3 py-2 text-sm disabled:opacity-50"
                      />
                      <button
                        type="button"
                        disabled={!hour.open}
                        onClick={() => removePeriod(hour.day, index)}
                        className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  {hour.open && hour.periods.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                      Nenhum intervalo cadastrado para este dia. Adicione um intervalo para abrir.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!hour.open}
                  onClick={() => addPeriod(hour.day)}
                  className="mt-3 rounded-lg bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  Adicionar intervalo
                </button>
              </div>
            ))}
            {hourErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                {hourErrors[0]}
              </div>
            )}
          </div>
        </section>

        <section className="order-6 rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-cyan-200">Impressão</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Selecione as impressoras instaladas neste computador por unidade e setor.
              </p>
            </div>
            {isDesktop && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refreshNativePrinters}
                  className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar lista de impressoras
                </button>
                <button
                  type="button"
                  onClick={addNativePrinter}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar impressora
                </button>
                <button
                  type="button"
                  onClick={() => window.maximusDesktop?.openPrintLogsFolder()}
                  className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  <FolderOpen className="h-4 w-4" />
                  Logs
                </button>
              </div>
            )}
          </div>

          {!isDesktop && (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-semibold text-amber-200">
              A seleção de impressoras instaladas está disponível apenas no aplicativo desktop. No
              navegador, use a impressão manual do próprio sistema como fallback.
            </p>
          )}

          {isDesktop && (
            <div className="mt-4 space-y-3">
              {localPrintSettings.printers.map((printer) => {
                const printerStatus = getPrinterStatus(printer, detectedPrinters);
                const connectionMode = printer.connectionMode ?? "system";
                return (
                  <div
                    key={printer.id}
                    className="rounded-lg border border-cyan-500/25 bg-background/70 p-3"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-extrabold">{printer.name || "Impressora"}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${printerStatus.className}`}
                      >
                        {printerStatus.label}
                      </span>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_150px_120px_auto]">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-muted-foreground">
                          Nome interno
                        </label>
                        <input
                          value={printer.name}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, { name: event.target.value })
                          }
                          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-muted-foreground">
                          Impressora instalada
                        </label>
                        <select
                          value={printer.deviceName}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, { deviceName: event.target.value })
                          }
                          disabled={connectionMode === "network"}
                          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                        >
                          <option value="">Selecione</option>
                          {detectedPrinters.map((item) => (
                            <option key={item.name} value={item.name}>
                              {item.displayName || item.name}
                              {item.isDefault ? " (padrão)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-muted-foreground">
                          Unidade
                        </label>
                        <select
                          value={printer.unitId}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, { unitId: event.target.value })
                          }
                          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                        >
                          {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-muted-foreground">
                          Setor
                        </label>
                        <select
                          value={printer.destination}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, {
                              destination: event.target
                                .value as MaximusPrinterConfig["destination"],
                            })
                          }
                          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                        >
                          <option value="kitchen">Cozinha</option>
                          <option value="cashier">Caixa</option>
                          <option value="bar">Bar</option>
                          <option value="custom">Personalizado</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNativePrinter(printer.id)}
                        className="self-end rounded-lg bg-secondary px-3 py-2 text-xs font-bold"
                        aria-label="Remover impressora"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-muted-foreground">
                          Modo de conexão
                        </label>
                        <select
                          value={connectionMode}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, {
                              connectionMode: event.target
                                .value as MaximusPrinterConfig["connectionMode"],
                            })
                          }
                          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                        >
                          {Object.entries(CONNECTION_MODE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {connectionMode === "network" && (
                        <div className="grid gap-3 sm:grid-cols-[1fr_110px_140px]">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">
                              IP
                            </label>
                            <input
                              value={printer.networkHost ?? ""}
                              onChange={(event) =>
                                updateNativePrinter(printer.id, { networkHost: event.target.value })
                              }
                              placeholder="Ex.: 192.168.0.50"
                              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">
                              Porta
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={printer.networkPort ?? 9100}
                              onChange={(event) =>
                                updateNativePrinter(printer.id, {
                                  networkPort: Math.max(1, Number(event.target.value)),
                                })
                              }
                              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">
                              Protocolo
                            </label>
                            <select
                              value={printer.networkProtocol ?? "raw"}
                              onChange={(event) =>
                                updateNativePrinter(printer.id, {
                                  networkProtocol: event.target
                                    .value as MaximusPrinterConfig["networkProtocol"],
                                })
                              }
                              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                            >
                              {Object.entries(NETWORK_PROTOCOL_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold">
                        Ligada
                        <input
                          type="checkbox"
                          checked={printer.enabled}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, { enabled: event.target.checked })
                          }
                          className="accent-primary"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold">
                        Impressão automática
                        <input
                          type="checkbox"
                          checked={printer.autoPrint}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, { autoPrint: event.target.checked })
                          }
                          className="accent-primary"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold">
                        Modo simulação
                        <input
                          type="checkbox"
                          checked={printer.simulate}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, { simulate: event.target.checked })
                          }
                          className="accent-primary"
                        />
                      </label>
                      <label className="text-xs font-bold text-muted-foreground">
                        Largura do papel
                        <select
                          value={printer.paperWidth}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, {
                              paperWidth: Number(event.target.value) as 58 | 80,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-xs font-bold"
                        >
                          <option value={58}>58 mm</option>
                          <option value={80}>80 mm</option>
                        </select>
                      </label>
                      <label className="text-xs font-bold text-muted-foreground">
                        Número de cópias
                        <input
                          type="number"
                          min="1"
                          value={printer.copies}
                          onChange={(event) =>
                            updateNativePrinter(printer.id, {
                              copies: Math.max(1, Number(event.target.value)),
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-xs font-bold"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={!isDesktop}
                        onClick={() => testNativePrinter(printer)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir teste
                      </button>
                    </div>
                  </div>
                );
              })}
              {localPrintSettings.printers.length === 0 && (
                <p className="rounded-lg border border-dashed border-cyan-500/30 p-3 text-sm font-semibold text-muted-foreground">
                  Nenhuma impressora local configurada.
                </p>
              )}
              {nativePrintStatus && (
                <p className="text-xs font-semibold text-muted-foreground">{nativePrintStatus}</p>
              )}
            </div>
          )}
        </section>

        <section className="order-4 rounded-xl border border-lime-500/35 bg-lime-500/10 p-5">
          <h2 className="text-lg font-semibold text-lime-200">WhatsApp automático</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envia notificações automáticas pelo WhatsApp quando o status do pedido é atualizado.
          </p>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-lime-500/25 bg-lime-500/10 p-3">
                <span className="block text-sm font-bold">Ativar envio automático</span>
                <input
                  type="checkbox"
                  checked={whatsappSettings.enabled}
                  onChange={(event) => updateWhatsappSettings({ enabled: event.target.checked })}
                  className="h-5 w-5 accent-primary"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3">
                <span className="block text-sm font-bold">Ativar bot de atendimento</span>
                <input
                  type="checkbox"
                  checked={whatsappSettings.botEnabled ?? false}
                  onChange={(event) => updateWhatsappSettings({ botEnabled: event.target.checked })}
                  className="h-5 w-5 accent-primary"
                />
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Número oficial do WhatsApp
              </label>
              <input
                value={whatsappSettings.officialNumber}
                onChange={(event) => updateWhatsappSettings({ officialNumber: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Mensagem inicial do bot
              </label>
              <textarea
                value={whatsappSettings.welcomeMessage ?? ""}
                onChange={(event) => updateWhatsappSettings({ welcomeMessage: event.target.value })}
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Mensagem de encaminhamento para atendente
              </label>
              <textarea
                value={whatsappSettings.humanMessage ?? ""}
                onChange={(event) => updateWhatsappSettings({ humanMessage: event.target.value })}
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {WHATSAPP_FIELDS.map((field, index) => (
              <div
                key={field.key}
                className={`rounded-lg border p-3 ${
                  WHATSAPP_STATUS_CARD_COLORS[index % WHATSAPP_STATUS_CARD_COLORS.length]
                }`}
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
                  <label className="flex items-center gap-3 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={whatsappSettings.statusSettings?.[field.key]?.enabled ?? true}
                      onChange={(event) =>
                        updateWhatsappSettings({
                          statusSettings: {
                            ...whatsappSettings.statusSettings,
                            [field.key]: {
                              enabled: event.target.checked,
                              mode: whatsappSettings.statusSettings?.[field.key]?.mode ?? "text",
                              message:
                                whatsappSettings.statusSettings?.[field.key]?.message ??
                                String(whatsappSettings[field.key] ?? ""),
                            },
                          } as WhatsappStatusSettings,
                        })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{field.label}</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Enviar neste status
                    </span>
                  </label>
                  <select
                    value={whatsappSettings.statusSettings?.[field.key]?.mode ?? "text"}
                    onChange={(event) =>
                      updateWhatsappSettings({
                        statusSettings: {
                          ...whatsappSettings.statusSettings,
                          [field.key]: {
                            enabled: whatsappSettings.statusSettings?.[field.key]?.enabled ?? true,
                            mode: event.target.value as WhatsappSendMode,
                            message:
                              whatsappSettings.statusSettings?.[field.key]?.message ??
                              String(whatsappSettings[field.key] ?? ""),
                          },
                        } as WhatsappStatusSettings,
                      })
                    }
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                  >
                    {Object.entries(WHATSAPP_SEND_MODE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Mensagem
                  </label>
                  <textarea
                    value={whatsappSettings.statusSettings?.[field.key]?.message ?? ""}
                    onChange={(event) =>
                      updateWhatsappSettings({
                        [field.key]: event.target.value,
                        statusSettings: {
                          ...whatsappSettings.statusSettings,
                          [field.key]: {
                            enabled: whatsappSettings.statusSettings?.[field.key]?.enabled ?? true,
                            mode: whatsappSettings.statusSettings?.[field.key]?.mode ?? "text",
                            message: event.target.value,
                          },
                        } as WhatsappStatusSettings,
                      } as Partial<WhatsappMessageSettings>)
                    }
                    className="min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Variáveis disponíveis: {"{orderNumber}"}, {"{customerName}"}, {"{total}"},{" "}
                  {"{unitName}"} e {"{trackingUrl}"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="order-5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-5">
          <h2 className="text-lg font-semibold text-cyan-200">Painel do entregador</h2>
          <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3">
            <span>
              <span className="block text-sm font-bold">Exigir conclusão pelo entregador</span>
              <span className="text-xs text-muted-foreground">
                Ativado: admin não finaliza entrega manualmente. Desativado: admin pode concluir.
              </span>
            </span>
            <input
              type="checkbox"
              checked={draft.driverPanelSettings?.enabled ?? false}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  driverPanelSettings: { enabled: event.target.checked },
                })
              }
              className="h-5 w-5 accent-primary"
            />
          </label>
        </section>
        <section className="order-7 rounded-xl border border-destructive/40 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-destructive" />
            <div>
              <h2 className="text-lg font-black text-destructive">Zona de risco</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Limpa dados operacionais no Supabase sem apagar unidades, configurações, cardápio ou
                regras de entrega.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setResetModalOpen(true);
              setResetConfirmation("");
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-extrabold text-white hover:opacity-90"
          >
            <Trash2 className="h-4 w-4" />
            Zerar dados operacionais
          </button>
        </section>

        <div className="order-8 flex items-center gap-3">
          <button
            disabled={!canSave}
            onClick={async () => {
              if (draft.id !== selectedUnit?.id) {
                setSaveStatus("error");
                toast.error("Troca de unidade em andamento. Aguarde os dados da unidade atual.");
                return;
              }
              setSaveStatus("saving");
              const unitPayload = {
                name: draft.name,
                phone: normalizePhoneInput(draft.phone),
                address: draft.address,
                latitude: draft.latitude,
                longitude: draft.longitude,
                isOpen: draft.isOpen,
                businessHours: draft.businessHours,
                theme: draft.theme,
                accessPin: draft.accessPin,
                publicAppUrl: draft.publicAppUrl?.trim() ?? "",
                acceptsDelivery: draft.acceptsDelivery ?? true,
                acceptsPickup: draft.acceptsPickup ?? true,
                acceptsDineIn: draft.acceptsDineIn ?? true,
                kitchenPrintSettings,
                whatsappSettings,
                driverPanelSettings: draft.driverPanelSettings,
                minimumOrderValue: draft.minimumOrderValue,
                baseDeliveryFee: draft.baseDeliveryFee,
                deliveryFeePerKm: draft.deliveryFeePerKm,
                maxDeliveryDistanceKm: draft.maxDeliveryDistanceKm,
                freeDeliveryFrom: draft.freeDeliveryFrom,
              };
              console.info("[Maximus][config][business-hours] payload salvo", {
                unitId: draft.id,
                businessHours: unitPayload.businessHours,
              });
              try {
                await updateUnit(unitPayload);
                console.info(
                  "[Maximus][config][business-hours] horários recarregados após salvar",
                  {
                    unitId: draft.id,
                    businessHours: unitPayload.businessHours,
                  },
                );
                setSaveStatus("saved");
                toast.success("Configurações salvas com sucesso.");
                window.setTimeout(() => setSaveStatus("idle"), 2500);
              } catch (error) {
                setSaveStatus("error");
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível salvar. Tente novamente.",
                );
              }
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground ${
              saveStatus === "saved"
                ? "bg-emerald-600"
                : saveStatus === "error"
                  ? "bg-destructive"
                  : "bg-primary"
            }`}
          >
            <Save className="h-4 w-4" />
            {saveStatus === "saving"
              ? "Salvando..."
              : saveStatus === "saved"
                ? "Salvo"
                : saveStatus === "error"
                  ? "Erro ao salvar"
                  : "Salvar configurações"}
          </button>
          {hourErrors.length > 0 && (
            <span className="text-sm font-bold text-destructive">
              Corrija os horários antes de salvar.
            </span>
          )}
        </div>
      </div>

      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="admin-root w-full max-w-md rounded-xl border border-destructive/40 bg-card p-6 font-sora shadow-xl">
            <h2 className="text-xl font-black text-destructive">Zerar dados operacionais</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta ação apaga pedidos, itens, pagamentos, clientes, endereços e entregadores de
              teste. Unidades, configurações, produtos, categorias, mesas e regras de entrega serão
              preservados.
            </p>
            <label className="mt-5 block text-sm font-bold">Digite ZERAR para confirmar</label>
            <input
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value.toUpperCase())}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-black tracking-widest"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetConfirmation !== "ZERAR" || resetting}
                onClick={async () => {
                  setResetting(true);
                  try {
                    await resetOperationalData("ZERAR");
                    toast.success("Dados operacionais zerados com sucesso.");
                    setResetModalOpen(false);
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível zerar os dados. Tente novamente.",
                    );
                  } finally {
                    setResetting(false);
                  }
                }}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resetting ? "Zerando..." : "Zerar dados"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
