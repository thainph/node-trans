import { app, BrowserWindow, ipcMain, systemPreferences, dialog, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Linux: disable SUID sandbox (requires root-owned chrome-sandbox otherwise)
// In production builds, electron-builder sets correct permissions automatically
if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
}

const isDev = !app.isPackaged;
const { autoUpdater } = require("electron-updater");

// Set environment variables BEFORE importing server modules
process.env.ELECTRON = "1";

// FFmpeg path:
// - Linux: always use system ffmpeg (ffmpeg-static lacks libpulse support)
// - Windows/Mac: use ffmpeg-static in dev, bundled binary in production
if (process.platform === "linux") {
  process.env.FFMPEG_PATH = "ffmpeg";
} else if (isDev) {
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

// Add ffmpeg directory to PATH so nodejs-whisper (which hardcodes "ffmpeg") can find it
const ffmpegDir = path.dirname(process.env.FFMPEG_PATH);
process.env.PATH = `${ffmpegDir}${path.delimiter}${process.env.PATH}`;

// audiocap (native system audio capture) — macOS: ScreenCaptureKit, Windows: WASAPI
if (isDev) {
  const { existsSync } = await import("fs");
  const isMac = process.platform === "darwin";
  const candidates = isMac
    ? [
        path.join(__dirname, "../swift-audiocap/.build/apple/Products/Release/audiocap"),
        path.join(__dirname, "../swift-audiocap/.build/release/audiocap"),
        path.join(__dirname, "../audiocap-bin/mac/audiocap"),
      ]
    : [
        path.join(__dirname, "../wasapi-audiocap/bin/Release/net8.0/win-x64/publish/audiocap.exe"),
        path.join(__dirname, "../audiocap-bin/win/audiocap.exe"),
      ];
  const found = candidates.find(existsSync);
  if (found) process.env.AUDIOCAP_PATH = found;
} else {
  const binName = process.platform === "win32" ? "audiocap.exe" : "audiocap";
  process.env.AUDIOCAP_PATH = path.join(process.resourcesPath, "audiocap", binName);
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

// Overlay window dragging via IPC (reliable on macOS with transparent frameless windows)
let overlayDragStart = null;

ipcMain.on("overlay:drag-start", () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const [x, y] = overlayWindow.getPosition();
    overlayDragStart = { x, y };
  }
});

// setPosition only accepts Int32 values: NaN/Infinity and -0 (e.g. Math.round(-0.4))
// make it throw "conversion failure", which crashes the main process.
function toInt32(n) {
  return Number.isFinite(n) ? Math.round(n) | 0 : null;
}

ipcMain.on("overlay:drag-move", (_e, dx, dy) => {
  if (!overlayWindow || overlayWindow.isDestroyed() || !overlayDragStart) return;
  const x = toInt32(overlayDragStart.x + Number(dx));
  const y = toInt32(overlayDragStart.y + Number(dy));
  if (x === null || y === null) return;
  try {
    overlayWindow.setPosition(x, y);
  } catch (err) {
    console.error("Overlay setPosition failed:", err.message);
  }
});

function setupAutoUpdate() {
  if (isDev) return;

  if (process.platform === "win32") {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", (info) => {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available",
        message: `Version ${info.version} is available. Download now?`,
        buttons: ["Download", "Later"],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
    });

    autoUpdater.on("update-downloaded", () => {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready",
        message: "Update downloaded. Restart to install?",
        buttons: ["Install & Restart", "Later"],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });

    autoUpdater.on("error", (err) => {
      console.error("Auto-update error:", err.message);
    });

    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  } else {
    setTimeout(checkForUpdatesMac, 3000);
  }
}

function isNewerVersion(latest, current) {
  const a = latest.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

async function checkForUpdatesMac() {
  try {
    const res = await fetch("https://api.github.com/repos/thainph/node-trans/releases/latest");
    if (!res.ok) return;
    const data = await res.json();
    const latestVersion = data.tag_name?.replace(/^v/, "");
    const currentVersion = app.getVersion();
    if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) return;

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update Available",
      message: `Version ${latestVersion} is available (current: ${currentVersion}). Open download page?`,
      buttons: ["Open Download Page", "Later"],
      defaultId: 0,
    });
    if (response === 0) shell.openExternal(data.html_url);
  } catch {
    // silently ignore network errors
  }
}

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

  setupAutoUpdate();

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
  app.quit();
});

app.on("before-quit", async () => {
  try {
    const { stopServer } = await import("../src/server.js");
    await stopServer();
  } catch {
    // Server already stopped
  }
});
