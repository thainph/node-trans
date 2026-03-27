import { app, BrowserWindow, ipcMain, systemPreferences } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

// Set environment variables BEFORE importing server modules
process.env.ELECTRON = "1";

// FFmpeg path: use ffmpeg-static in dev, bundled binary in production
if (isDev) {
  try {
    process.env.FFMPEG_PATH = require("ffmpeg-static");
  } catch {
    process.env.FFMPEG_PATH = "ffmpeg";
  }
} else {
  process.env.FFMPEG_PATH = path.join(
    process.resourcesPath,
    "ffmpeg",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  );
}

// Data directory: use Electron's userData path
process.env.ELECTRON_USER_DATA = app.getPath("userData");

let mainWindow;
let overlayWindow;
let appPort;

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    return;
  }

  const overlayWidth = 500;
  const overlayHeight = 220;

  // Default: bottom-right of main window
  let x, y;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const { x: mx, y: my, width: mw, height: mh } = mainWindow.getBounds();
    x = Math.round(mx + mw - overlayWidth);
    y = Math.round(my + mh - overlayHeight);
  }

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x,
    y,
    minWidth: 300,
    minHeight: 100,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    focusable: true,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      preload: path.join(__dirname, "overlay-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep always on top even when other apps go fullscreen (macOS)
  overlayWindow.setAlwaysOnTop(true, "floating");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    overlayWindow.loadURL("http://localhost:5173/overlay.html");
  } else {
    overlayWindow.loadURL(`http://localhost:${appPort}/overlay.html`);
  }

  overlayWindow.on("closed", () => {
    overlayWindow = null;
    // Notify main window that overlay was closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("overlay:closed");
    }
  });
}

function closeOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

// IPC handlers
ipcMain.on("overlay:toggle", (_e, { settings, utterances, partials }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    closeOverlayWindow();
  } else {
    createOverlayWindow();
    // Send initial data once the overlay page is ready
    if (overlayWindow) {
      overlayWindow.webContents.once("did-finish-load", () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("overlay:data", {
            type: "init",
            utterances: utterances || [],
            partials: partials || {},
            settings: settings || {},
          });
        }
      });
    }
  }
});

ipcMain.on("overlay:data", (_e, data) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay:data", data);
  }
});

ipcMain.on("overlay:settings", (_e, settings) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay:settings", settings);
  }
});

ipcMain.on("overlay:close", () => {
  closeOverlayWindow();
});

app.whenReady().then(async () => {
  // Request microphone permission on macOS (triggers system dialog on first run)
  if (process.platform === "darwin") {
    const micStatus = systemPreferences.getMediaAccessStatus("microphone");
    if (micStatus !== "granted") {
      await systemPreferences.askForMediaAccess("microphone");
    }
  }

  // Start the Express server
  const { startServer } = await import("../src/server.js");
  const port = await startServer();
  appPort = port;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://localhost:${port}`);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
      });
      mainWindow.loadURL(`http://localhost:${port}`);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
