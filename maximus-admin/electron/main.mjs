import { app, BrowserWindow, Menu, dialog, shell } from "electron";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(process.env.ELECTRON_DEV_URL);
const devUrl = process.env.ELECTRON_DEV_URL ?? "";

let mainWindow = null;
let nitroProcess = null;
let appOrigin = isDevelopment ? new URL(devUrl).origin : null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function resolvePreloadPath() {
  return path.join(__dirname, "preload.mjs");
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
  await waitForServer(`${baseUrl}/login`);
  appOrigin = baseUrl;

  return `${baseUrl}/login`;
}

function stopNitroServer() {
  if (!nitroProcess || nitroProcess.killed) return;
  nitroProcess.kill();
  nitroProcess = null;
}

async function createMainWindow() {
  Menu.setApplicationMenu(null);

  const initialUrl = isDevelopment ? devUrl : await startNitroServer();

  mainWindow = new BrowserWindow({
    title: "Maximus Admin",
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
  createMainWindow().catch(showStartupError);
});
