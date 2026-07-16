import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Printer, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import type { KitchenPrintSettings, PrintSectorKey } from "@/admin/data/types";
import { loadSupabaseKitchenPrintSettings } from "@/admin/supabase-data";
import { useAdmin } from "@/admin/store";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/admin/impressao")({
  component: ImpressaoPage,
});

type SaveStatus = "idle" | "saving" | "saved" | "error";

type SectorDefinition = {
  key: PrintSectorKey;
  label: string;
  description: string;
};

const SECTORS: SectorDefinition[] = [
  {
    key: "cashier",
    label: "Caixa / Atendimento",
    description: "Imprime vias do caixa e conferência geral.",
  },
  {
    key: "kitchen",
    label: "Cozinha",
    description: "Imprime pedidos de produção.",
  },
  {
    key: "bar",
    label: "Bar / Bebidas",
    description: "Imprime bebidas, se usado.",
  },
  {
    key: "dispatch",
    label: "Expedição / Entrega",
    description: "Imprime conferência de saída e entrega.",
  },
];

function emptyPrinterForSector(
  sector: SectorDefinition,
  unitId: string,
  printerName = "",
): MaximusPrinterConfig {
  return {
    id: `printer-${unitId}-${sector.key}`,
    name: sector.label,
    deviceName: printerName,
    unitId,
    destination: sector.key,
    connectionMode: "system",
    networkHost: "",
    networkPort: 9100,
    networkProtocol: "raw",
    enabled: sector.key !== "bar",
    autoPrint: true,
    paperWidth: 80,
    copies: 1,
    margin: 0,
    scaleFactor: 100,
    simulate: false,
  };
}

function normalizeSettings(settings?: MaximusPrintSettings): MaximusPrintSettings {
  return {
    version: 1,
    printers: Array.isArray(settings?.printers) ? settings.printers : [],
  };
}

function mergeSectorPrinters(
  current: MaximusPrintSettings,
  unitId: string,
  sectorPrinters: MaximusPrinterConfig[],
) {
  const sectorKeys = new Set(SECTORS.map((sector) => sector.key));
  const others = current.printers.filter(
    (printer) =>
      printer.unitId !== unitId || !sectorKeys.has(printer.destination as PrintSectorKey),
  );
  return normalizeSettings({
    version: 1,
    printers: [...others, ...sectorPrinters],
  });
}

function kitchenSettingsFromPrinters(
  previous: KitchenPrintSettings | undefined,
  printers: MaximusPrinterConfig[],
): KitchenPrintSettings {
  const kitchenPrinter = printers.find((printer) => printer.destination === "kitchen");
  return {
    autoPrintEnabled: printers.some((printer) => printer.enabled && printer.autoPrint),
    printerName: kitchenPrinter?.deviceName || previous?.printerName || "Cozinha",
    printerIp: previous?.printerIp ?? "",
    printerPort: previous?.printerPort ?? 9100,
    printerType: previous?.printerType ?? "escpos",
    copies: previous?.copies ?? 1,
    enabled: printers.some((printer) => printer.enabled),
    autoPrint: printers.some((printer) => printer.autoPrint),
    sectors: Object.fromEntries(
      SECTORS.map((sector) => {
        const printer = printers.find((item) => item.destination === sector.key);
        return [
          sector.key,
          {
            enabled: Boolean(printer?.enabled),
            label: sector.label,
            printerName: printer?.deviceName ?? "",
            paperWidth: printer?.paperWidth ?? 80,
            margin: printer?.margin ?? 0,
            copies: printer?.copies ?? 1,
            autoPrint: printer?.autoPrint ?? true,
            scaleFactor: printer?.scaleFactor ?? 100,
          },
        ];
      }),
    ),
  };
}

function printersFromSavedSettings(
  unitId: string,
  savedSettings: KitchenPrintSettings | undefined,
  localSettings: MaximusPrintSettings,
) {
  return SECTORS.map((sector) => {
    const localPrinter = localSettings.printers.find(
      (printer) => printer.unitId === unitId && printer.destination === sector.key,
    );
    const savedSector = savedSettings?.sectors?.[sector.key];
    const savedPrinterName = savedSector?.printerName || localPrinter?.deviceName || "";
    return {
      ...emptyPrinterForSector(sector, unitId, savedPrinterName),
      ...localPrinter,
      id: localPrinter?.id ?? `printer-${unitId}-${sector.key}`,
      name: sector.label,
      unitId,
      destination: sector.key,
      enabled: savedSector?.enabled ?? localPrinter?.enabled ?? sector.key !== "bar",
      autoPrint:
        savedSector?.autoPrint ?? savedSettings?.autoPrint ?? localPrinter?.autoPrint ?? true,
      paperWidth: savedSector?.paperWidth ?? localPrinter?.paperWidth ?? 80,
      margin: savedSector?.margin ?? localPrinter?.margin ?? 0,
      copies: savedSector?.copies ?? localPrinter?.copies ?? 1,
      scaleFactor: savedSector?.scaleFactor ?? localPrinter?.scaleFactor ?? 100,
      deviceName: savedPrinterName,
    };
  });
}

function ImpressaoPage() {
  const { selectedUnit, updateUnit } = useAdmin();
  const [detectedPrinters, setDetectedPrinters] = useState<MaximusLocalPrinter[]>([]);
  const [printSettings, setPrintSettings] = useState<MaximusPrintSettings>(() =>
    normalizeSettings(),
  );
  const [sectorPrinters, setSectorPrinters] = useState<MaximusPrinterConfig[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState("");
  const autoSearchedForUnit = useRef<string | null>(null);

  const unitId = selectedUnit?.id ?? "";
  const printerBridge = typeof window !== "undefined" ? window.maximusPrinter : undefined;
  const desktopBridge = typeof window !== "undefined" ? window.maximusDesktop : undefined;
  const isDesktop = Boolean(desktopBridge?.isElectron || printerBridge?.listPrinters);
  const canListPrinters = Boolean(printerBridge?.listPrinters);

  const loadSavedConfiguration = useCallback(
    async (fallbackSettings?: KitchenPrintSettings) => {
      if (!unitId) return false;
      setSupabaseLoaded(false);
      setLastError("");
      try {
        const localSettings = normalizeSettings(await desktopBridge?.getPrintSettings());
        let savedSettings = fallbackSettings;
        let savedAt: string | null = null;
        if (isSupabaseConfigured) {
          const snapshot = await loadSupabaseKitchenPrintSettings(unitId);
          savedSettings = snapshot.settings;
          savedAt = snapshot.savedAt;
          setSupabaseLoaded(true);
        }
        setPrintSettings(localSettings);
        setLastSavedAt(savedAt);
        setSectorPrinters(printersFromSavedSettings(unitId, savedSettings, localSettings));
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha ao carregar configuração do Supabase.";
        setLastError(message);
        setSectorPrinters((current) =>
          current.length
            ? current
            : printersFromSavedSettings(unitId, fallbackSettings, normalizeSettings()),
        );
        return false;
      }
    },
    [desktopBridge, unitId],
  );

  useEffect(() => {
    if (!unitId) return;
    void loadSavedConfiguration(selectedUnit?.kitchenPrintSettings);
  }, [loadSavedConfiguration, unitId]);

  const defaultPrinter = useMemo(
    () => detectedPrinters.find((printer) => printer.isDefault),
    [detectedPrinters],
  );

  const refreshPrinters = useCallback(async () => {
    const listPrinters = printerBridge?.listPrinters;
    if (!listPrinters) {
      setFeedback(
        "A ponte de impressão do app Windows não está disponível. Reinicie o aplicativo.",
      );
      setLastError("Ponte de impressão inativa.");
      return;
    }
    setLoadingPrinters(true);
    setFeedback("Buscando impressoras...");
    try {
      const result = await listPrinters();
      if (!result.ok) throw new Error(result.error ?? "Falha ao buscar impressoras.");
      setDetectedPrinters(result.printers ?? []);
      setLastError("");
      setFeedback("Impressoras atualizadas.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao buscar impressoras.";
      setFeedback(message);
      setLastError(message);
      toast.error(message);
    } finally {
      setLoadingPrinters(false);
    }
  }, [printerBridge]);

  useEffect(() => {
    if (!unitId || !printerBridge?.listPrinters || autoSearchedForUnit.current === unitId) return;
    autoSearchedForUnit.current = unitId;
    void refreshPrinters();
  }, [printerBridge, refreshPrinters, unitId]);

  function updateSectorPrinter(sectorKey: PrintSectorKey, patch: Partial<MaximusPrinterConfig>) {
    setSectorPrinters((current) =>
      current.map((printer) =>
        printer.destination === sectorKey ? { ...printer, ...patch } : printer,
      ),
    );
    setStatus("idle");
  }

  async function testSectorPrinter(printer: MaximusPrinterConfig) {
    if (!printer.deviceName) return;
    const sector = SECTORS.find((item) => item.key === printer.destination);
    setFeedback(`Testando ${sector?.label ?? "setor"}...`);
    const result = printerBridge?.testPrinter
      ? await printerBridge.testPrinter({
          printerName: printer.deviceName,
          sectorKey: printer.destination,
          sectorName: sector?.label ?? printer.name,
          paperWidth: printer.paperWidth,
          copies: printer.copies,
          margin: printer.margin,
          scaleFactor: printer.scaleFactor,
        })
      : await desktopBridge!.printTest({
          ...printer,
          html: `<html><body><main style="font-family:Arial;padding:8px"><h1>MAXIMUS</h1><p>Teste de impressão</p><p>Setor: ${sector?.label ?? printer.name}</p><p>Data/hora: ${new Date().toLocaleString("pt-BR")}</p><p>----------------</p></main></body></html>`,
        });
    if (result.ok) {
      setFeedback("Teste enviado.");
      toast.success("Teste enviado.");
      return;
    }
    setFeedback(result.error ?? "Erro ao testar impressora.");
    toast.error("Erro ao testar impressora.");
  }

  async function saveChanges() {
    if (!selectedUnit || status === "saving") return;
    setStatus("saving");
    const nextSettings = mergeSectorPrinters(printSettings, selectedUnit.id, sectorPrinters);
    const persistedSettings = kitchenSettingsFromPrinters(
      selectedUnit.kitchenPrintSettings,
      sectorPrinters,
    );
    try {
      if (desktopBridge) {
        const saved = await desktopBridge.savePrintSettings(nextSettings);
        setPrintSettings(normalizeSettings(saved));
      }
      await updateUnit({
        kitchenPrintSettings: persistedSettings,
      });
      const confirmed = await loadSavedConfiguration(persistedSettings);
      if (isSupabaseConfigured && !confirmed) {
        throw new Error("A configuração foi enviada, mas não pôde ser confirmada no Supabase.");
      }
      setStatus("saved");
      setFeedback("Configuração salva");
      setLastError("");
      toast.success("Configuração salva");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch (error) {
      setStatus("error");
      const message = error instanceof Error ? error.message : "Erro ao salvar impressão.";
      setFeedback(message);
      setLastError(message);
      toast.error(message);
    }
  }

  return (
    <div className="pb-24">
      <PageHeader title="Impressão" subtitle="Configure as impressoras por setor." />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {!isDesktop && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
            Para buscar impressoras locais, abra o aplicativo Windows do Maximus.
          </div>
        )}

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold">Impressoras locais</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {isDesktop
                  ? `${detectedPrinters.length} impressora(s) encontrada(s).`
                  : "Disponível apenas no app Windows."}
              </p>
            </div>
            <button
              type="button"
              disabled={!isDesktop || !canListPrinters || loadingPrinters}
              onClick={refreshPrinters}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${loadingPrinters ? "animate-spin" : ""}`} />
              Buscar impressoras
            </button>
          </div>
          {defaultPrinter && (
            <p className="mt-3 text-xs font-semibold text-muted-foreground">
              Padrão do sistema: {defaultPrinter.displayName || defaultPrinter.name}
            </p>
          )}
        </section>

        <section className="grid gap-3">
          {SECTORS.map((sector) => {
            const printer = sectorPrinters.find((item) => item.destination === sector.key);
            const selectedPrinter = printer?.deviceName ?? "";
            const savedPrinterIsDetected = detectedPrinters.some(
              (item) => item.name === selectedPrinter,
            );
            return (
              <div key={sector.key} className="rounded-lg border border-border bg-card p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_minmax(220px,320px)_96px] lg:items-center">
                  <div>
                    <h2 className="text-sm font-extrabold">{sector.label}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{sector.description}</p>
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs font-bold">
                    Ativo
                    <input
                      type="checkbox"
                      checked={Boolean(printer?.enabled)}
                      onChange={(event) =>
                        updateSectorPrinter(sector.key, { enabled: event.target.checked })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                  <select
                    value={selectedPrinter}
                    disabled={!isDesktop}
                    onChange={(event) =>
                      updateSectorPrinter(sector.key, { deviceName: event.target.value })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {isDesktop ? "Selecionar impressora" : "Disponível apenas no app Windows"}
                    </option>
                    {selectedPrinter && !savedPrinterIsDetected && (
                      <option value={selectedPrinter}>{selectedPrinter} (salva)</option>
                    )}
                    {detectedPrinters.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.displayName || item.name}
                        {item.isDefault ? " (padrão)" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!isDesktop || !selectedPrinter}
                    onClick={() => printer && testSectorPrinter(printer)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-secondary px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4" />
                    Testar
                  </button>
                </div>

                <details className="group mt-3 border-t border-border/70 pt-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-2 text-xs font-extrabold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground">
                    <span>Calibrar papel e impressão</span>
                    <span className="text-[11px] font-semibold group-open:hidden">
                      {printer?.paperWidth ?? 80} mm · escala {printer?.scaleFactor ?? 100}%
                    </span>
                    <span className="hidden text-[11px] font-semibold group-open:inline">
                      Fechar ajustes
                    </span>
                  </summary>

                  <div className="mt-3 grid gap-5 rounded-lg border border-border/70 bg-background/45 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div>
                      <h3 className="text-sm font-extrabold">Ajuste real da impressora</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Estes valores são enviados ao driver do Windows no teste e na impressão
                        automática.
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <label className="grid gap-1.5 text-xs font-bold">
                          Bobina
                          <select
                            value={printer?.paperWidth ?? 80}
                            onChange={(event) =>
                              updateSectorPrinter(sector.key, {
                                paperWidth: Number(event.target.value) === 58 ? 58 : 80,
                              })
                            }
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value={80}>80 mm</option>
                            <option value={58}>58 mm</option>
                          </select>
                        </label>
                        <label className="grid gap-1.5 text-xs font-bold">
                          Margem de segurança
                          <div className="flex h-10 items-center rounded-md border border-input bg-background px-3">
                            <input
                              type="number"
                              min={0}
                              max={8}
                              step={0.5}
                              value={printer?.margin ?? 0}
                              onChange={(event) =>
                                updateSectorPrinter(sector.key, {
                                  margin: Math.min(8, Math.max(0, Number(event.target.value) || 0)),
                                })
                              }
                              className="w-full bg-transparent text-sm outline-none"
                            />
                            <span className="text-xs text-muted-foreground">mm</span>
                          </div>
                        </label>
                        <label className="grid gap-1.5 text-xs font-bold">
                          Escala do conteúdo
                          <div className="flex h-10 items-center rounded-md border border-input bg-background px-3">
                            <input
                              type="number"
                              min={50}
                              max={100}
                              step={1}
                              value={printer?.scaleFactor ?? 100}
                              onChange={(event) =>
                                updateSectorPrinter(sector.key, {
                                  scaleFactor: Math.min(
                                    100,
                                    Math.max(50, Number(event.target.value) || 100),
                                  ),
                                })
                              }
                              className="w-full bg-transparent text-sm outline-none"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </label>
                        <label className="grid gap-1.5 text-xs font-bold">
                          Cópias
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={printer?.copies ?? 1}
                            onChange={(event) =>
                              updateSectorPrinter(sector.key, {
                                copies: Math.min(5, Math.max(1, Number(event.target.value) || 1)),
                              })
                            }
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          />
                        </label>
                      </div>
                      <label className="mt-4 flex max-w-xs items-center justify-between rounded-md border border-border bg-secondary/50 px-3 py-2.5 text-xs font-bold">
                        Impressão automática
                        <input
                          type="checkbox"
                          checked={Boolean(printer?.autoPrint)}
                          onChange={(event) =>
                            updateSectorPrinter(sector.key, { autoPrint: event.target.checked })
                          }
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                    </div>

                    <div className="rounded-lg border border-border bg-secondary/25 p-3">
                      <p className="text-center text-[11px] font-bold text-muted-foreground">
                        Visualização da área imprimível
                      </p>
                      <div className="mt-3 flex min-h-40 items-center justify-center overflow-hidden">
                        <div
                          className="relative h-36 bg-white shadow-md transition-all"
                          style={{ width: `${(printer?.paperWidth ?? 80) * 3}px` }}
                        >
                          <div
                            className="absolute inset-y-0 border-x border-dashed border-red-400/80 bg-slate-100 px-2 py-3 text-center text-[10px] text-slate-700 transition-all"
                            style={{
                              left: `${(printer?.margin ?? 0) * 3}px`,
                              right: `${(printer?.margin ?? 0) * 3}px`,
                            }}
                          >
                            <div
                              style={{
                                transform: `scale(${(printer?.scaleFactor ?? 100) / 100})`,
                                transformOrigin: "top center",
                              }}
                            >
                              <strong>PEDIDO #000</strong>
                              <div className="mt-2 border-t border-dashed border-slate-400 pt-2">
                                Área efetiva do conteúdo
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-center text-[11px] text-muted-foreground">
                        Área útil:{" "}
                        {Math.max(
                          40,
                          (printer?.paperWidth ?? 80) - (printer?.margin ?? 0) * 2,
                        ).toFixed(1)}{" "}
                        mm
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            );
          })}
        </section>

        {feedback && <p className="text-xs font-semibold text-muted-foreground">{feedback}</p>}

        <section className="grid gap-1 rounded-lg border border-border/70 bg-card/60 px-4 py-3 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <span>Configuração carregada do Supabase: {supabaseLoaded ? "Sim" : "Não"}</span>
          <span>
            Última configuração salva em:{" "}
            {lastSavedAt ? new Date(lastSavedAt).toLocaleString("pt-BR") : "—"}
          </span>
          <span>Electron detectado: {isDesktop ? "Sim" : "Não"}</span>
          <span>Ponte de impressão: {canListPrinters ? "Ativa" : "Inativa"}</span>
          <span>Impressoras carregadas: {detectedPrinters.length}</span>
          <span className={lastError ? "text-destructive" : undefined}>
            Último erro: {lastError || "Nenhum"}
          </span>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#18191b]/95 px-3 py-3 text-white backdrop-blur md:left-56">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold">Impressão</p>
            <p className="text-[11px] text-white/60">Configuração por setor da unidade.</p>
          </div>
          <button
            type="button"
            disabled={status === "saving"}
            onClick={saveChanges}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/45 ${
              status === "saved"
                ? "bg-emerald-600"
                : status === "error"
                  ? "bg-destructive"
                  : "bg-primary"
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {status === "saving"
              ? "Salvando..."
              : status === "saved"
                ? "Salvo"
                : status === "error"
                  ? "Erro ao salvar"
                  : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
