import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Copy, Printer, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import type {
  AdminUnit,
  BusinessHour,
  KitchenPrintSettings,
  KitchenPrinterType,
  UnitTheme,
  WeekdayKey,
  WhatsappMessageSettings,
  WhatsappSendMode,
  WhatsappStatusSettings,
  WhatsappStatusMessages,
} from "@/admin/data/types";
import { printKitchenTest } from "@/admin/printing";
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

const PRINTER_TYPE_LABELS: Record<KitchenPrinterType, string> = {
  escpos: "ESC/POS",
  thermal_generic: "Térmica genérica",
  a4: "A4",
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
  const { selectedUnit, updateUnit, resetOperationalData } = useAdmin();
  const [draft, setDraft] = useState<AdminUnit | null>(selectedUnit);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const selectedUnitRef = useRef(selectedUnit);
  const selectedUnitId = selectedUnit?.id;

  useEffect(() => {
    selectedUnitRef.current = selectedUnit;
  }, [selectedUnit]);

  useEffect(() => {
    const unit = selectedUnitRef.current;
    console.info("[Maximus][config][business-hours] horários carregados", {
      unitId: unit?.id ?? null,
      businessHours: unit?.businessHours ?? null,
    });
    setDraft(unit ?? null);
    setSaveStatus("idle");
    setTestStatus("idle");
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

  function updateKitchenPrintSettings(patch: Partial<KitchenPrintSettings>) {
    if (!draft) return;
    setDraft({
      ...draft,
      kitchenPrintSettings: {
        ...kitchenPrintSettings,
        ...patch,
      },
    });
    markDirty();
    setTestStatus("idle");
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

        <section className="order-6 rounded-xl border border-violet-500/35 bg-violet-500/10 p-5">
          <h2 className="text-lg font-semibold text-violet-200">Impressão automática</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preparado para print-agent local. O teste valida a configuração salva.
          </p>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-violet-500/25 bg-violet-500/10 p-3">
              <span>
                <span className="block text-sm font-bold">Ativar impressão automática</span>
                <span className="text-xs text-muted-foreground">
                  Dispara ao mover pedido para Em produção.
                </span>
              </span>
              <input
                type="checkbox"
                checked={kitchenPrintSettings.autoPrintEnabled}
                onChange={(event) =>
                  updateKitchenPrintSettings({ autoPrintEnabled: event.target.checked })
                }
                className="h-5 w-5 accent-primary"
              />
            </label>

            <div>
              <h3 className="text-sm font-extrabold">Impressora da cozinha</h3>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Nome</label>
              <input
                value={kitchenPrintSettings.printerName}
                onChange={(event) =>
                  updateKitchenPrintSettings({ printerName: event.target.value })
                }
                placeholder="Ex.: Cozinha"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">IP</label>
                <input
                  value={kitchenPrintSettings.printerIp}
                  onChange={(event) =>
                    updateKitchenPrintSettings({ printerIp: event.target.value })
                  }
                  placeholder="Ex.: 192.168.0.50"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Porta</label>
                <input
                  type="number"
                  min="1"
                  value={kitchenPrintSettings.printerPort}
                  onChange={(event) =>
                    updateKitchenPrintSettings({
                      printerPort: Math.max(1, Number(event.target.value)),
                    })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  Tipo da impressora
                </label>
                <select
                  value={kitchenPrintSettings.printerType}
                  onChange={(event) =>
                    updateKitchenPrintSettings({
                      printerType: event.target.value as KitchenPrinterType,
                    })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(PRINTER_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Número de vias</label>
                <input
                  type="number"
                  min="1"
                  value={kitchenPrintSettings.copies}
                  onChange={(event) =>
                    updateKitchenPrintSettings({ copies: Math.max(1, Number(event.target.value)) })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={async () => {
                  setTestStatus("testing");
                  try {
                    await printKitchenTest(kitchenPrintSettings);
                    setTestStatus("success");
                  } catch {
                    setTestStatus("failed");
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-bold hover:bg-accent"
              >
                <Printer className="h-4 w-4" />
                {testStatus === "testing" ? "Testando..." : "Testar impressão"}
              </button>
              {testStatus === "success" && (
                <span className="text-sm font-bold text-emerald-500">Teste local enviado</span>
              )}
              {testStatus === "failed" && (
                <span className="text-sm font-bold text-destructive">Falha no teste local</span>
              )}
            </div>
          </div>
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
