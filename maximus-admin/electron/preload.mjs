import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("maximusDesktop", {
  isElectron: true,
  platform: process.platform,
});
