import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("maximusDesktop", {
  isElectron: true,
  platform: process.platform,
  listPrinters: () => ipcRenderer.invoke("maximus:list-printers"),
  getPrintSettings: () => ipcRenderer.invoke("maximus:get-print-settings"),
  savePrintSettings: (settings) => ipcRenderer.invoke("maximus:save-print-settings", settings),
  printHtml: (payload) => ipcRenderer.invoke("maximus:print-html", payload),
  printTest: (payload) => ipcRenderer.invoke("maximus:print-test", payload),
  printToPdf: (payload) => ipcRenderer.invoke("maximus:print-to-pdf", payload),
  openPrintLogsFolder: () => ipcRenderer.invoke("maximus:open-print-logs-folder"),
});
