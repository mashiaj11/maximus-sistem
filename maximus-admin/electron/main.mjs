import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require("electron");
const isDevelopment = Boolean(process.env.ELECTRON_DEV_URL);
const devUrl = process.env.ELECTRON_DEV_URL ?? "";
const configuredUpdateUrl = String(process.env.MAXIMUS_UPDATE_URL ?? "").trim();

let autoUpdater = null;
let updaterLoadError = null;

try {
  ({ autoUpdater } = require("electron-updater"));
} catch (error) {
  updaterLoadError = error;
}

let mainWindow = null;
let nitroProcess = null;
let appOrigin = isDevelopment ? new URL(devUrl).origin : null;
let updaterInitialized = false;
let updaterInstallPromptOpen = false;

const PRINT_TIMEOUT_MS = 30000;
const PRINT_RENDER_WAIT_MS = 5000;
const UPDATER_STATE_CHANNEL = "maximus:updater:state-changed";

const updaterState = {
  enabled: Boolean(autoUpdater && configuredUpdateUrl),
  status: "idle",
  currentVersion: app.getVersion(),
  nextVersion: null,
  percent: 0,
  transferred: 0,
  total: 0,
  bytesPerSecond: 0,
  releaseNotes: null,
  error: autoUpdater
    ? configuredUpdateUrl
      ? null
      : "MAXIMUS_UPDATE_URL não configurada."
    : "electron-updater não carregou.",
  checkedAt: null,
};

function userDataPath(...segments) {
  return path.join(app.getPath("userData"), ...segments);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function appendPrintLog(entry) {
  const dir = userDataPath("print-logs");
  await ensureDir(dir);
  const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.log`);
  await fs.appendFile(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

async function appendUpdateLog(entry) {
  const dir = userDataPath("update-logs");
  await ensureDir(dir);
  const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.log`);
  await fs.appendFile(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

function printSettingsFile() {
  return userDataPath("print-settings.json");
}

async function readPrintSettings() {
  try {
    const raw = await fs.readFile(printSettingsFile(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      printers: Array.isArray(parsed.printers) ? parsed.printers : [],
    };
  } catch {
    return { version: 1, printers: [] };
  }
}

async function writePrintSettings(settings) {
  await ensureDir(app.getPath("userData"));
  const clean = {
    version: 1,
    printers: Array.isArray(settings?.printers) ? settings.printers : [],
  };
  await fs.writeFile(printSettingsFile(), JSON.stringify(clean, null, 2));
  return clean;
}

function normalizePrintOptions(payload = {}) {
  const paperWidth = Number(payload.paperWidth) === 58 ? 58 : 80;
  const margin = Number.isFinite(Number(payload.margin)) ? Math.max(0, Number(payload.margin)) : 0;
  const marginPixels = (margin * 96) / 25.4;
  const scaleFactor = Math.min(100, Math.max(50, Number(payload.scaleFactor ?? 100)));
  return {
    silent: true,
    printBackground: true,
    deviceName: payload.deviceName,
    copies: Math.max(1, Number(payload.copies ?? 1)),
    scaleFactor,
    margins: {
      marginType: "custom",
      top: marginPixels,
      bottom: marginPixels,
      left: marginPixels,
      right: marginPixels,
    },
    pageSize: { width: Math.round(paperWidth * 1000), height: 297000 },
  };
}

function normalizeHtmlDocument(html) {
  const content = String(html ?? "");
  if (!content.trim()) throw new Error("HTML de impressão vazio.");
  if (/<html[\s>]/i.test(content) && /<body[\s>]/i.test(content)) return content;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /></head><body>${content}</body></html>`;
}

async function writeTemporaryPrintHtml(html) {
  const dir = userDataPath("print-temp");
  await ensureDir(dir);
  const file = path.join(dir, `print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  await fs.writeFile(file, normalizeHtmlDocument(html), "utf8");
  return file;
}

function withTimeout(promise, timeoutMs, label) {
  let timeout = null;
  return Promise.race([
    promise.finally(() => {
      if (timeout) clearTimeout(timeout);
    }),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label} excedeu ${timeoutMs}ms.`)), timeoutMs);
    }),
  ]);
}

async function waitForRenderedDocument(printWindow) {
  await withTimeout(
    printWindow.webContents.executeJavaScript(
      `Promise.all([
        document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
        Promise.all(Array.from(document.images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          });
        })),
      ]).then(() => true)`,
      true,
    ),
    PRINT_RENDER_WAIT_MS,
    "renderização da impressão",
  );
}

async function withHiddenPrintWindow(html, task) {
  const file = await writeTemporaryPrintHtml(html);
  const printWindow = new BrowserWindow({
    show: false,
    width: 420,
    height: 800,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  try {
    // loadFile only resolves after did-finish-load. Waiting for that event again
    // can miss it and keep Windows print jobs blocked until the timeout.
    await printWindow.loadFile(file);
    await waitForRenderedDocument(printWindow);
    return await task(printWindow);
  } finally {
    if (!printWindow.isDestroyed()) printWindow.close();
    fs.unlink(file).catch(() => {});
  }
}

async function printHtml(payload = {}) {
  const html = normalizeHtmlDocument(payload.html);
  const options = normalizePrintOptions(payload);
  const result = await withHiddenPrintWindow(
    html,
    (printWindow) =>
      new Promise((resolve, reject) => {
        printWindow.webContents.print(options, (success, failureReason) => {
          if (success) {
            resolve({ ok: true, mode: "printed" });
            return;
          }
          reject(new Error(failureReason || "Falha ao imprimir."));
        });
      }),
  );
  await appendPrintLog({
    type: payload.manual ? "manualReprint" : "printHtml",
    ok: true,
    deviceName: options.deviceName,
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    destination: payload.destination,
  });
  return result;
}

async function printToPdf(payload = {}) {
  const html = normalizeHtmlDocument(payload.html);
  const unit = String(payload.unitId ?? "unidade").replace(/[^a-z0-9_-]+/gi, "-");
  const order = String(payload.orderNumber ?? payload.orderId ?? "teste").replace(
    /[^a-z0-9_-]+/gi,
    "-",
  );
  const destination = String(payload.destination ?? "print").replace(/[^a-z0-9_-]+/gi, "-");
  const dir = userDataPath("print-simulation");
  await ensureDir(dir);
  const file = path.join(
    dir,
    `${unit}-${order}-${destination}-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`,
  );
  const pdf = await withHiddenPrintWindow(html, (printWindow) =>
    printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: normalizePrintOptions(payload).pageSize,
      marginsType: 1,
    }),
  );
  await fs.writeFile(file, pdf);
  await appendPrintLog({
    type: payload.manual ? "manualReprintPdf" : "printToPdf",
    ok: true,
    file,
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    destination: payload.destination,
  });
  return { ok: true, mode: "simulated", file };
}

function buildPrinterTestHtml(payload = {}) {
  const sectorName = String(payload.sectorName ?? "Setor");
  const paperWidth = Number(payload.paperWidth) === 58 ? 58 : 80;
  const now = new Date().toLocaleString("pt-BR");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      @page { size: ${paperWidth}mm auto; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; }
      body { font-family: Arial, sans-serif; font-size: 13px; }
      main { width: 100%; max-width: 100%; padding: 3mm; overflow: hidden; }
      h1 { margin: 0 0 4mm; text-align: center; font-size: 22px; }
      p { margin: 1.5mm 0; }
      .line { margin-top: 4mm; border-top: 1px dashed #000; }
    </style></head><body><main>
      <h1>MAXIMUS</h1>
      <p><strong>Teste de impressão</strong></p>
      <p>Setor: ${sectorName.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>
      <p>Data/hora: ${now}</p>
      <p class="line">----------------</p>
    </main></body></html>`;
}

async function invokeDesktopPrint(channel, handler, payload) {
  try {
    return await withTimeout(handler(payload), PRINT_TIMEOUT_MS + 5000, channel);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await appendPrintLog({ type: channel, ok: false, error: message });
    return { ok: false, error: message };
  }
}

function registerPrintIpc() {
  const listPrinters = async () => {
    try {
      const printers = await mainWindow?.webContents.getPrintersAsync();
      return { ok: true, printers: printers ?? [] };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Falha ao listar." };
    }
  };
  ipcMain.handle("maximus:list-printers", listPrinters);
  ipcMain.handle("maximus:printers:list", listPrinters);
  ipcMain.handle("maximus:get-print-settings", () => readPrintSettings());
  ipcMain.handle("maximus:save-print-settings", (_event, settings) => writePrintSettings(settings));
  ipcMain.handle("maximus:print-html", (_event, payload) =>
    invokeDesktopPrint("printHtml", printHtml, payload),
  );
  ipcMain.handle("maximus:print-test", (_event, payload) =>
    invokeDesktopPrint("printTest", (data) => printHtml(data), payload),
  );
  ipcMain.handle("maximus:printer:test", (_event, payload = {}) =>
    invokeDesktopPrint(
      "printerTest",
      (data) =>
        printHtml({
          html: buildPrinterTestHtml(data),
          deviceName: data.printerName,
          paperWidth: data.paperWidth,
          copies: data.copies,
          margin: data.margin,
          scaleFactor: data.scaleFactor,
          destination: data.sectorKey,
        }),
      payload,
    ),
  );
  ipcMain.handle("maximus:print-to-pdf", (_event, payload) =>
    invokeDesktopPrint("printToPdf", printToPdf, payload),
  );
  ipcMain.handle("maximus:open-print-logs-folder", async () => {
    const dir = userDataPath("print-logs");
    await ensureDir(dir);
    await shell.openPath(dir);
    return { ok: true, path: dir };
  });
}

function cloneUpdaterState() {
  return { ...updaterState };
}

function normalizeReleaseNotes(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.note ?? item?.version ?? "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(value);
}

function broadcastUpdaterState() {
  const state = cloneUpdaterState();
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(UPDATER_STATE_CHANNEL, state);
    }
  });
}

function updateUpdaterState(patch, logEvent) {
  Object.assign(updaterState, patch);
  broadcastUpdaterState();
  if (logEvent) {
    appendUpdateLog({ event: logEvent, state: cloneUpdaterState() }).catch((error) => {
      console.error("[updater] falha ao gravar log", error);
    });
  }
  return cloneUpdaterState();
}

function updateDisabledUpdaterState(error) {
  return updateUpdaterState(
    {
      enabled: false,
      status: "idle",
      error,
      checkedAt: new Date().toISOString(),
    },
    "disabled",
  );
}

async function promptInstallDownloadedUpdate() {
  if (updaterInstallPromptOpen || !autoUpdater) return;
  updaterInstallPromptOpen = true;
  try {
    const { response } = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: "info",
      buttons: ["Reiniciar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
      title: "Atualização pronta",
      message: "A atualização do Maximus Admin foi baixada.",
      detail: "Reinicie o aplicativo para aplicar a nova versão.",
    });
    if (response === 0) {
      updateUpdaterState({ status: "installing", error: null }, "install-started");
      autoUpdater.quitAndInstall(false, true);
    }
  } finally {
    updaterInstallPromptOpen = false;
  }
}

function initializeAutoUpdater() {
  if (updaterInitialized) return cloneUpdaterState();
  updaterInitialized = true;

  if (!autoUpdater) {
    const message =
      updaterLoadError instanceof Error
        ? updaterLoadError.message
        : "electron-updater não está disponível.";
    return updateDisabledUpdaterState(message);
  }

  if (!configuredUpdateUrl) {
    return updateDisabledUpdaterState("MAXIMUS_UPDATE_URL não configurada.");
  }

  updateUpdaterState({ enabled: true, error: null }, "configured");

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({ provider: "generic", url: configuredUpdateUrl });

  autoUpdater.on("checking-for-update", () => {
    updateUpdaterState(
      {
        status: "checking",
        error: null,
        percent: 0,
        transferred: 0,
        total: 0,
        bytesPerSecond: 0,
        checkedAt: new Date().toISOString(),
      },
      "checking-for-update",
    );
  });

  autoUpdater.on("update-available", (info) => {
    updateUpdaterState(
      {
        status: "available",
        nextVersion: info?.version ?? null,
        releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
        error: null,
        checkedAt: new Date().toISOString(),
      },
      "update-available",
    );
  });

  autoUpdater.on("update-not-available", () => {
    updateUpdaterState(
      {
        status: "idle",
        nextVersion: null,
        releaseNotes: null,
        percent: 0,
        transferred: 0,
        total: 0,
        bytesPerSecond: 0,
        error: null,
        checkedAt: new Date().toISOString(),
      },
      "update-not-available",
    );
  });

  autoUpdater.on("download-progress", (progress) => {
    updateUpdaterState(
      {
        status: "downloading",
        percent: Number(progress?.percent ?? 0),
        transferred: Number(progress?.transferred ?? 0),
        total: Number(progress?.total ?? 0),
        bytesPerSecond: Number(progress?.bytesPerSecond ?? 0),
        error: null,
      },
      "download-progress",
    );
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateUpdaterState(
      {
        status: "downloaded",
        nextVersion: info?.version ?? updaterState.nextVersion,
        releaseNotes: normalizeReleaseNotes(info?.releaseNotes) ?? updaterState.releaseNotes,
        percent: 100,
        error: null,
      },
      "update-downloaded",
    );
    promptInstallDownloadedUpdate().catch((error) => {
      console.error("[updater] falha ao solicitar instalação", error);
    });
  });

  autoUpdater.on("error", (error) => {
    updateUpdaterState(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      },
      "error",
    );
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      updateUpdaterState(
        {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          checkedAt: new Date().toISOString(),
        },
        "startup-check-failed",
      );
    });
  }, 2500);

  return cloneUpdaterState();
}

function registerUpdaterIpc() {
  ipcMain.handle("maximus:updater:get-state", () => cloneUpdaterState());
  ipcMain.handle("maximus:updater:check", async () => {
    initializeAutoUpdater();
    if (!autoUpdater || !configuredUpdateUrl) return cloneUpdaterState();
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      updateUpdaterState(
        {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          checkedAt: new Date().toISOString(),
        },
        "manual-check-failed",
      );
    }
    return cloneUpdaterState();
  });
  ipcMain.handle("maximus:updater:download", async () => {
    initializeAutoUpdater();
    if (!autoUpdater || !configuredUpdateUrl) return cloneUpdaterState();
    if (updaterState.status !== "available") return cloneUpdaterState();
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      updateUpdaterState(
        {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
        "download-failed",
      );
    }
    return cloneUpdaterState();
  });
  ipcMain.handle("maximus:updater:install", () => {
    initializeAutoUpdater();
    if (!autoUpdater || updaterState.status !== "downloaded") return cloneUpdaterState();
    updateUpdaterState({ status: "installing", error: null }, "install-requested");
    autoUpdater.quitAndInstall(false, true);
    return cloneUpdaterState();
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function resolvePreloadPath() {
  return path.join(__dirname, "preload.cjs");
}

function resolveNitroEntry() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ".output", "server", "index.mjs");
  }

  return path.join(app.getAppPath(), ".output", "server", "index.mjs");
}

function isAllowedUrl(targetUrl) {
  if (!appOrigin) return false;

  try {
    return new URL(targetUrl).origin === appOrigin;
  } catch {
    return false;
  }
}

function findAvailablePort(startPort = 4178) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();

      server.once("error", (error) => {
        if (error.code === "EADDRINUSE" || error.code === "EACCES") {
          tryPort(port + 1);
          return;
        }

        reject(error);
      });

      server.once("listening", () => {
        server.close(() => resolve(port));
      });

      server.listen(port, "127.0.0.1");
    };

    tryPort(startPort);
  });
}

function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.setTimeout(1000, () => {
        request.destroy();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Servidor local não respondeu em ${url}.`));
          return;
        }

        setTimeout(check, 250);
      });
    };

    check();
  });
}

async function startNitroServer() {
  const serverEntry = resolveNitroEntry();
  const port = await findAvailablePort(4178);

  nitroProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NITRO_HOST: "127.0.0.1",
      NITRO_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  nitroProcess.stdout?.on("data", (chunk) => {
    console.log(`[nitro] ${chunk.toString().trim()}`);
  });

  nitroProcess.stderr?.on("data", (chunk) => {
    console.error(`[nitro] ${chunk.toString().trim()}`);
  });

  nitroProcess.once("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(`[nitro] encerrado com código ${code ?? "desconhecido"}`);
    }
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${baseUrl}/admin`);
  appOrigin = baseUrl;

  return `${baseUrl}/admin`;
}

function stopNitroServer() {
  if (!nitroProcess || nitroProcess.killed) return;
  nitroProcess.kill();
  nitroProcess = null;
}

async function createMainWindow() {
  Menu.setApplicationMenu(null);

  const initialUrl = isDevelopment ? devUrl : await startNitroServer();
  const windowIcon = path.join(app.getAppPath(), "build", "icon.ico");

  mainWindow = new BrowserWindow({
    title: "Maximus Admin",
    icon: windowIcon,
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    show: false,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (isDevelopment) {
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          webPreferences: {
            preload: resolvePreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
          },
        },
      };
    }

    shell.openExternal(url).catch((error) => {
      console.error("[electron] falha ao abrir link externo", error);
    });
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedUrl(url)) return;

    event.preventDefault();
    shell.openExternal(url).catch((error) => {
      console.error("[electron] falha ao abrir navegação externa", error);
    });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(initialUrl);
}

app.on("second-instance", () => {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch(showStartupError);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopNitroServer();
});

function showStartupError(error) {
  console.error("[electron] falha ao iniciar", error);
  dialog.showErrorBox(
    "Falha ao iniciar o Maximus Admin",
    error instanceof Error ? error.message : "O servidor local não conseguiu iniciar.",
  );
  app.quit();
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.maximus.admin");
  }
  registerPrintIpc();
  registerUpdaterIpc();
  createMainWindow()
    .then(() => {
      initializeAutoUpdater();
    })
    .catch(showStartupError);
});
