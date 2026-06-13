import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, MessageCircle, Printer, Save, Trash2 } from "lucide-react";
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
  officialNumber: "",
  provider: "none",
  apiUrl: "",
  apiKey: "",
  instanceId: "",
  receivedMessage: "Recebemos seu pedido na Maximus. Em breve nossa equipe vai confirmar.",
  acceptedMessage: "Seu pedido foi aceito e já entrou no fluxo da Maximus.",
  productionMessage: "Seu pedido está em produção.",
  readyMessage: "Seu pedido está pronto.",
  outForDeliveryMessage: "Seu pedido saiu para entrega.",
  driverOnWayMessage: "Seu entregador está a caminho.",
  driverNearbyMessage: "Seu entregador está a 500 metros.",
  deliveredMessage: "Pedido entregue. Obrigado por comprar com a Maximus.",
};

const WHATSAPP_FIELDS: Array<{ key: keyof WhatsappMessageSettings; label: string }> = [
  { key: "receivedMessage", label: "Pedido recebido" },
  { key: "acceptedMessage", label: "Pedido aceito" },
  { key: "productionMessage", label: "Pedido em produção" },
  { key: "readyMessage", label: "Pedido pronto" },
  { key: "outForDeliveryMessage", label: "Saiu para entrega" },
  { key: "driverOnWayMessage", label: "Entregador a caminho" },
  { key: "driverNearbyMessage", label: "Entregador a 500 metros" },
  { key: "deliveredMessage", label: "Pedido entregue" },
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

function ConfiguracoesPage() {
  const { selectedUnit, updateUnit, resetOperationalData } = useAdmin();
  const [draft, setDraft] = useState<AdminUnit | null>(selectedUnit);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [messageTested, setMessageTested] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    console.info("[Maximus][config][business-hours] horários carregados", {
      unitId: selectedUnit?.id ?? null,
      businessHours: selectedUnit?.businessHours ?? null,
      hasLocalEdits,
    });
    setDraft((currentDraft) => {
      if (!selectedUnit) return null;
      if (hasLocalEdits && currentDraft?.id === selectedUnit.id) {
        return currentDraft;
      }
      return selectedUnit;
    });
  }, [selectedUnit, hasLocalEdits]);

  useEffect(() => {
    setHasLocalEdits(false);
    setSaveStatus("idle");
    setTestStatus("idle");
  }, [selectedUnit?.id]);

  const whatsappSettings: WhatsappMessageSettings = {
    ...DEFAULT_WHATSAPP_SETTINGS,
    officialNumber: draft?.phone ?? "",
    ...draft?.whatsappSettings,
  };
  const whatsAppLink = useMemo(
    () => buildWhatsAppLink(whatsappSettings.officialNumber || draft?.phone || ""),
    [draft?.phone, whatsappSettings.officialNumber],
  );

  if (!draft) return null;

  function markDirty() {
    setHasLocalEdits(true);
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
    setMessageTested(false);
  }

  const hourErrors = validateBusinessHours(draft.businessHours);
  const canSave = saveStatus !== "saving" && hourErrors.length === 0;

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle={`Dados reais da unidade · ${selectedUnit?.name ?? "Unidade"}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Unidade</h2>
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
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                WhatsApp gerado
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
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
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
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Tema visual</label>
              <select
                value={draft.theme}
                onChange={(event) => setDraft({ ...draft, theme: event.target.value as UnitTheme })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="dark">Dark</option>
                <option value="light">Claro</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Horário de funcionamento</h2>
          <div className="mt-4 space-y-3">
            {draft.businessHours.map((hour) => (
              <div key={hour.day} className="rounded-lg border border-border bg-background p-3">
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

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Impressão automática</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preparado para print-agent local. O teste valida a configuração salva.
          </p>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
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

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">WhatsApp automático</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurado para simulação. Integração real futura: Evolution API, Waha ou Z-API.
          </p>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
              <span>
                <span className="block text-sm font-bold">Ativar envio automático</span>
                <span className="text-xs text-muted-foreground">
                  Hoje apenas registra configuração; não envia mensagens reais.
                </span>
              </span>
              <input
                type="checkbox"
                checked={whatsappSettings.enabled}
                onChange={(event) => updateWhatsappSettings({ enabled: event.target.checked })}
                className="h-5 w-5 accent-primary"
              />
            </label>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Provider</label>
                <select
                  value={whatsappSettings.provider ?? "none"}
                  onChange={(event) =>
                    updateWhatsappSettings({
                      provider: event.target.value as WhatsappMessageSettings["provider"],
                    })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="none">Nenhum / simulado</option>
                  <option value="evolution">Evolution API</option>
                  <option value="waha">Waha</option>
                  <option value="zapi">Z-API</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Instância</label>
                <input
                  value={whatsappSettings.instanceId ?? ""}
                  onChange={(event) => updateWhatsappSettings({ instanceId: event.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">URL da API</label>
              <input
                value={whatsappSettings.apiUrl ?? ""}
                onChange={(event) => updateWhatsappSettings({ apiUrl: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Chave da API</label>
              <input
                value={whatsappSettings.apiKey ?? ""}
                onChange={(event) => updateWhatsappSettings({ apiKey: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {WHATSAPP_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm text-muted-foreground">{field.label}</label>
                <textarea
                  value={String(whatsappSettings[field.key] ?? "")}
                  onChange={(event) =>
                    updateWhatsappSettings({
                      [field.key]: event.target.value,
                    } as Partial<WhatsappMessageSettings>)
                  }
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMessageTested(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-bold hover:bg-accent"
            >
              <MessageCircle className="h-4 w-4" />
              Testar mensagem simulada
            </button>
            {messageTested && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-muted-foreground">
                Simulação pronta. Nenhuma mensagem real foi enviada.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Painel do entregador</h2>
          <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
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
      </div>

      <section className="mt-6 rounded-xl border border-destructive/40 bg-card p-5">
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

      <div className="mt-6 flex items-center gap-3">
        <button
          disabled={!canSave}
          onClick={async () => {
            setSaveStatus("saving");
            const unitPayload = {
              name: draft.name,
              phone: draft.phone,
              address: draft.address,
              latitude: draft.latitude,
              longitude: draft.longitude,
              isOpen: draft.isOpen,
              businessHours: draft.businessHours,
              theme: draft.theme,
              accessPin: draft.accessPin,
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
              console.info("[Maximus][config][business-hours] horários recarregados após salvar", {
                unitId: draft.id,
                businessHours: unitPayload.businessHours,
              });
              setHasLocalEdits(false);
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
