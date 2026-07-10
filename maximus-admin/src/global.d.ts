export {};

declare global {
  type MaximusPrintSectorKey = "cashier" | "kitchen" | "bar" | "dispatch";

  interface MaximusLocalPrinter {
    name: string;
    displayName?: string;
    status?: number | string;
    isDefault?: boolean;
  }

  interface MaximusPrinterConfig {
    id: string;
    name: string;
    deviceName: string;
    unitId: string;
    destination: MaximusPrintSectorKey | "custom";
    connectionMode?: "system" | "network";
    networkHost?: string;
    networkPort?: number;
    networkProtocol?: "raw" | "escpos";
    enabled: boolean;
    autoPrint: boolean;
    paperWidth: 58 | 80;
    copies: number;
    margin: number;
    simulate: boolean;
  }

  interface MaximusPrintSettings {
    version: number;
    printers: MaximusPrinterConfig[];
  }

  interface MaximusPrinterBridge {
    listPrinters: () => Promise<{
      ok: boolean;
      printers?: MaximusLocalPrinter[];
      error?: string;
    }>;
    testPrinter: (
      payload: Record<string, unknown>,
    ) => Promise<{ ok: boolean; mode?: string; error?: string }>;
  }

  type MaximusUpdaterStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "error";

  interface MaximusUpdaterState {
    enabled: boolean;
    status: MaximusUpdaterStatus;
    currentVersion: string;
    nextVersion: string | null;
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
    releaseNotes: string | null;
    error: string | null;
    checkedAt: string | null;
  }

  interface Window {
    maximusDesktop?: {
      isElectron: true;
      platform: string;
      listPrinters: () => Promise<{
        ok: boolean;
        printers?: MaximusLocalPrinter[];
        error?: string;
      }>;
      getPrintSettings: () => Promise<MaximusPrintSettings>;
      savePrintSettings: (settings: MaximusPrintSettings) => Promise<MaximusPrintSettings>;
      printHtml: (
        payload: Record<string, unknown>,
      ) => Promise<{ ok: boolean; mode?: string; error?: string }>;
      printTest: (
        payload: Record<string, unknown>,
      ) => Promise<{ ok: boolean; mode?: string; error?: string }>;
      printToPdf: (
        payload: Record<string, unknown>,
      ) => Promise<{ ok: boolean; mode?: string; file?: string; error?: string }>;
      openPrintLogsFolder: () => Promise<{ ok: boolean; path?: string; error?: string }>;
      updater: {
        getState: () => Promise<MaximusUpdaterState>;
        check: () => Promise<MaximusUpdaterState>;
        download: () => Promise<MaximusUpdaterState>;
        install: () => Promise<MaximusUpdaterState>;
        onStateChanged: (callback: (state: MaximusUpdaterState) => void) => () => void;
      };
    };
    maximusPrinter?: MaximusPrinterBridge;
  }
}
