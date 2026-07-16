const { contextBridge, ipcRenderer } = require("electron");

const UPDATER_STATE_CHANNEL = "maximus:updater:state-changed";

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
  updater: {
    getState: () => ipcRenderer.invoke("maximus:updater:get-state"),
    check: () => ipcRenderer.invoke("maximus:updater:check"),
    download: () => ipcRenderer.invoke("maximus:updater:download"),
    install: () => ipcRenderer.invoke("maximus:updater:install"),
    onStateChanged: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, state) => callback(state);
      ipcRenderer.on(UPDATER_STATE_CHANNEL, listener);
      return () => ipcRenderer.removeListener(UPDATER_STATE_CHANNEL, listener);
    },
  },
});

contextBridge.exposeInMainWorld("maximusPrinter", {
  listPrinters: () => ipcRenderer.invoke("maximus:printers:list"),
  testPrinter: (payload) => ipcRenderer.invoke("maximus:printer:test", payload),
});
