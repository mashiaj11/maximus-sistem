import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Printer, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/admin/components/AdminLayout";
import type { KitchenPrintSettings, PrintSectorKey } from "@/admin/data/types";
import { useAdmin } from "@/admin/store";

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
    (printer) => printer.unitId !== unitId || !sectorKeys.has(printer.destination as PrintSectorKey),
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
          },
        ];
      }),
    ),
  };
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

  const unitId = selectedUnit?.id ?? "";
  const printerBridge = typeof window !== "undefined" ? window.maximusPrinter : undefined;
  const desktopBridge = typeof window !== "undefined" ? window.maximusDesktop : undefined;
  const isDesktop = Boolean(desktopBridge?.isElectron);
  const canListPrinters = Boolean(printerBridge?.listPrinters ?? desktopBridge?.listPrinters);

  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;

    async function loadSettings() {
      const settings = normalizeSettings(await desktopBridge?.getPrintSettings());
      if (cancelled) return;
      setPrintSettings(settings);
      setSectorPrinters(
        SECTORS.map((sector) => {
          const saved = settings.printers.find(
            (printer) => printer.unitId === unitId && printer.destination === sector.key,
          );
          const unitSector = selectedUnit?.kitchenPrintSettings?.sectors?.[sector.key];
          return {
            ...emptyPrinterForSector(sector, unitId, unitSector?.printerName ?? ""),
            ...saved,
            id: saved?.id ?? `printer-${unitId}-${sector.key}`,
            name: sector.label,
            unitId,
            destination: sector.key,
            enabled: saved?.enabled ?? unitSector?.enabled ?? sector.key !== "bar",
            autoPrint: saved?.autoPrint ?? true,
            deviceName: saved?.deviceName ?? unitSector?.printerName ?? "",
          };
        }),
      );
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [desktopBridge, selectedUnit?.kitchenPrintSettings?.sectors, unitId]);

  const defaultPrinter = useMemo(
    () => detectedPrinters.find((printer) => printer.isDefault),
    [detectedPrinters],
  );

  async function refreshPrinters() {
    const listPrinters = printerBridge?.listPrinters ?? desktopBridge?.listPrinters;
    if (!listPrinters) {
      setFeedback("A ponte de impressão do app Windows não está disponível. Reinicie o aplicativo.");
      return;
    }
    setLoadingPrinters(true);
    setFeedback("Buscando impressoras...");
    try {
      const result = await listPrinters();
      if (!result.ok) throw new Error(result.error ?? "Falha ao buscar impressoras.");
      setDetectedPrinters(result.printers ?? []);
      setFeedback("Impressoras atualizadas.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao buscar impressoras.";
      setFeedback(message);
      toast.error(message);
    } finally {
      setLoadingPrinters(false);
    }
  }

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
    try {
      if (desktopBridge) {
        const saved = await desktopBridge.savePrintSettings(nextSettings);
        setPrintSettings(normalizeSettings(saved));
      }
      await updateUnit({
        kitchenPrintSettings: kitchenSettingsFromPrinters(
          selectedUnit.kitchenPrintSettings,
          sectorPrinters,
        ),
      });
      setStatus("saved");
      setFeedback("Configuração salva.");
      toast.success("Configuração de impressão salva.");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch (error) {
      setStatus("error");
      const message = error instanceof Error ? error.message : "Erro ao salvar impressão.";
      setFeedback(message);
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
            return (
              <div
                key={sector.key}
                className="grid gap-3 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_120px_minmax(220px,320px)_96px] lg:items-center"
              >
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
            );
          })}
        </section>

        {feedback && <p className="text-xs font-semibold text-muted-foreground">{feedback}</p>}
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
