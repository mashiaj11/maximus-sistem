export {};

declare global {
  interface MaximusPrinterConfig {
    id: string;
    name: string;
    deviceName: string;
    unitId: string;
    destination: "kitchen" | "cashier" | "bar" | "custom";
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

  interface Window {
    maximusDesktop?: {
      isElectron: true;
      platform: string;
      listPrinters: () => Promise<{
        ok: boolean;
        printers?: Array<{
          name: string;
          displayName?: string;
          status?: number;
          isDefault?: boolean;
        }>;
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
    };
  }
}
