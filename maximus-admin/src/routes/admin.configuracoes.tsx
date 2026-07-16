import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import type { AdminUnit, BusinessHour, WeekdayKey } from "@/admin/data/types";
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

type StoreAddressDraft = {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  reference: string;
};

const EMPTY_STORE_ADDRESS: StoreAddressDraft = {
  cep: "",
  street: "",
  number: "",
  neighborhood: "",
  city: "Santarém",
  state: "PA",
  complement: "",
  reference: "",
};

function parseStoreAddress(address?: string): StoreAddressDraft {
  const draft = { ...EMPTY_STORE_ADDRESS };
  const value = address?.trim();
  if (!value) return draft;

  const parts = value
    .split(/\s[·|]\s|;/)
    .map((part) => part.trim())
    .filter(Boolean);
  const streetLine = parts.find(
    (part) => !/^(bairro|compl\.?|ref\.?|cep):/i.test(part) && !part.includes("/"),
  );
  const neighborhood = parts.find((part) => /^bairro:/i.test(part)) ?? parts[1];
  const cityState = parts.find((part) => part.includes("/")) ?? parts[2];
  const complement = parts.find((part) => /^compl\.?:/i.test(part));
  const reference = parts.find((part) => /^ref\.?:/i.test(part));
  const cep = parts.find((part) => /^cep:/i.test(part));
  const streetMatch = streetLine?.match(/^(.+?)(?:,\s*([^,]+))?$/);
  if (streetMatch?.[1]) draft.street = streetMatch[1].trim();
  if (streetMatch?.[2]) draft.number = streetMatch[2].trim();
  if (neighborhood) draft.neighborhood = neighborhood.replace(/^Bairro:\s*/i, "").trim();
  if (cityState) {
    const [city, state] = cityState.split("/").map((part) => part.trim());
    if (city) draft.city = city;
    if (state) draft.state = state;
  }
  if (complement) draft.complement = complement.replace(/^Compl\.?:\s*/i, "").trim();
  if (reference) draft.reference = reference.replace(/^Ref\.?:\s*/i, "").trim();
  if (cep) draft.cep = cep.replace(/^CEP:\s*/i, "").trim();
  return draft;
}

function formatStoreAddress(address: StoreAddressDraft) {
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.neighborhood,
    [address.city, address.state].filter(Boolean).join("/"),
    address.complement ? `Compl.: ${address.complement}` : "",
    address.reference ? `Ref.: ${address.reference}` : "",
    address.cep ? `CEP: ${address.cep}` : "",
  ]
    .filter((part) => part.trim())
    .join(" · ");
}

function ConfiguracoesPage() {
  const { selectedUnit, updateUnit } = useAdmin();
  const [draft, setDraft] = useState<AdminUnit | null>(selectedUnit);
  const [addressDraft, setAddressDraft] = useState<StoreAddressDraft>(() =>
    parseStoreAddress(selectedUnit?.address),
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
    setAddressDraft(parseStoreAddress(unit?.address));
    setSaveStatus("idle");
  }, [selectedUnitId]);

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

  function updateAddressDraft(patch: Partial<StoreAddressDraft>) {
    setAddressDraft((current) => ({ ...current, ...patch }));
    markDirty();
  }

  const hourErrors = draft ? validateBusinessHours(draft.businessHours) : [];
  const canSave = Boolean(draft) && saveStatus !== "saving" && hourErrors.length === 0;

  async function handleSaveConfig() {
    if (!canSave || !draft) return;
    if (draft.id !== selectedUnit?.id) {
      setSaveStatus("error");
      toast.error("Troca de unidade em andamento. Aguarde os dados da unidade atual.");
      return;
    }
    setSaveStatus("saving");
    const unitPayload = {
      name: draft.name,
      phone: normalizePhoneInput(draft.phone),
      address: formatStoreAddress(addressDraft),
      isOpen: draft.isOpen,
      businessHours: draft.businessHours,
      theme: draft.theme,
      publicAppUrl: draft.publicAppUrl?.trim() ?? "",
      acceptsDelivery: draft.acceptsDelivery ?? true,
      acceptsPickup: draft.acceptsPickup ?? true,
      acceptsDineIn: draft.acceptsDineIn ?? true,
      kitchenPrintSettings: draft.kitchenPrintSettings,
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
      setSaveStatus("saved");
      toast.success("Configurações salvas com sucesso.");
      window.setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (error) {
      setSaveStatus("error");
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.",
      );
    }
  }

  return (
    <div className="pb-20">
      <PageHeader title="Configurações" subtitle={`${selectedUnit?.name ?? "Unidade"}`} />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="order-1 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-extrabold">Dados da loja</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Nome da loja</label>
              <input
                value={draft.name}
                onChange={(event) => {
                  setDraft({ ...draft, name: event.target.value });
                  markDirty();
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Telefone principal</label>
              <input
                value={draft.phone}
                onChange={(event) => {
                  setDraft({ ...draft, phone: normalizePhoneInput(event.target.value) });
                  markDirty();
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/50 p-3">
              <span>
                <span className="block text-sm font-bold">Loja aberta</span>
                <span className="text-xs text-muted-foreground">Controla disponibilidade.</span>
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
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/50 p-3"
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
          </div>
        </section>

        <section className="order-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-extrabold">Endereço da loja</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted-foreground">CEP</label>
              <input
                value={addressDraft.cep}
                onChange={(event) => updateAddressDraft({ cep: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-sm text-muted-foreground">Rua / Avenida</label>
              <input
                value={addressDraft.street}
                onChange={(event) => updateAddressDraft({ street: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Número</label>
              <input
                value={addressDraft.number}
                onChange={(event) => updateAddressDraft({ number: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted-foreground">Bairro</label>
              <input
                value={addressDraft.neighborhood}
                onChange={(event) => updateAddressDraft({ neighborhood: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted-foreground">Cidade</label>
              <input
                value={addressDraft.city}
                onChange={(event) => updateAddressDraft({ city: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Estado</label>
              <input
                value={addressDraft.state}
                onChange={(event) => updateAddressDraft({ state: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-sm text-muted-foreground">Complemento</label>
              <input
                value={addressDraft.complement}
                onChange={(event) => updateAddressDraft({ complement: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-sm text-muted-foreground">Referência</label>
              <input
                value={addressDraft.reference}
                onChange={(event) => updateAddressDraft({ reference: event.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="order-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-extrabold">Sistema</h2>
          <div className="mt-3 space-y-3">
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
              <p className="mt-1 text-xs text-muted-foreground">Base dos links e QR Codes.</p>
            </div>
          </div>
        </section>

        <section className="order-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-extrabold">Funcionamento</h2>
          <div className="mt-3 space-y-2">
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

        <section className="order-6 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold">Impressão</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A configuração por setor fica em uma tela própria.
              </p>
            </div>
            <Link
              to="/admin/impressao"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-extrabold text-primary-foreground"
            >
              Abrir Impressão
            </Link>
          </div>
        </section>

        <div className="order-8 hidden items-center gap-3">
          <button
            disabled={!canSave}
            onClick={handleSaveConfig}
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#18191b]/95 px-3 py-3 text-white shadow-none backdrop-blur md:left-56">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold">Configurações</p>
            <p className="text-[11px] text-white/60">
              {hourErrors.length > 0
                ? "Corrija os horários antes de salvar."
                : "Alterações da unidade"}
            </p>
          </div>
          <button
            disabled={!canSave}
            onClick={handleSaveConfig}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/45 ${
              saveStatus === "saved"
                ? "bg-emerald-600"
                : saveStatus === "error"
                  ? "bg-destructive"
                  : "bg-primary"
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {saveStatus === "saving"
              ? "Salvando..."
              : saveStatus === "saved"
                ? "Salvo"
                : saveStatus === "error"
                  ? "Erro"
                  : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
