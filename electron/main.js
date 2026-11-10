import { app, BrowserWindow, ipcMain, systemPreferences, dialog, shell, session, Menu, nativeTheme } from "electron";
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

// Logger (imported after ELECTRON_USER_DATA is set so it writes to <userData>/data/logs)
const { createLogger } = await import("../src/logger.js");
const log = createLogger("electron");
const LOGS_DIR = path.join(app.getPath("userData"), "data", "logs");

let mainWindow;
let overlayWindow;
let appPort;

// ---------- Error reporting: nothing in the main process may crash the app silently ----------

let lastError = { message: "", at: 0 };
// Errors raised while the window is still loading; delivered once the UI can show them
const pendingUiErrors = [];

function flushUiErrors() {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  if (!win) return;
  // Give React a moment to mount and subscribe to app:error
  setTimeout(() => {
    while (pendingUiErrors.length && !win.isDestroyed()) win.webContents.send("app:error", pendingUiErrors.shift());
  }, 800);
}

// Log the error and show it to the user: as a toast in the window when it's up,
// otherwise as a native error box. Identical errors within 3s are shown once.
function reportMainError(label, err) {
  const message = err?.message || String(err);
  log.error(label, err instanceof Error ? { message, code: err.code, stack: err.stack } : { message });
  console.error(`[main] ${label}:`, err);

  const now = Date.now();
  if (message === lastError.message && now - lastError.at < 3000) return;
  lastError = { message, at: now };

  const payload = { message: `${label}: ${message}`, detail: err?.code ? `code ${err.code}` : undefined };
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  if (win && !win.webContents.isLoading()) {
    win.webContents.send("app:error", payload);
  } else if (win) {
    pendingUiErrors.push(payload);
  } else if (app.isReady()) {
    dialog.showErrorBox(label, `${message}\n\nLogs: ${LOGS_DIR}`);
  }
}

// Replaces Electron's default "Uncaught Exception" dialog: report and keep running
process.on("uncaughtException", (err) => reportMainError("Unexpected error", err));
process.on("unhandledRejection", (reason) => reportMainError("Unhandled error", reason));

// Only one instance: a second launch would fight over the server port and the database.
// It just brings the existing window to the front instead.
const gotSingleInstanceLock = isDev || app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

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

  // Fully transparent window (no vibrancy) so the user's opacity setting can go near zero
  // over video; the renderer paints the rounded HUD surface, border and blur itself.
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
    // Native shadows on transparent windows don't follow the CSS-rounded surface
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    focusable: true,
    // macOS: an NSPanel can float above full-screen apps without changing the app's
    // activation policy (see setVisibleOnAllWorkspaces below)
    ...(process.platform === "darwin" && { type: "panel" }),
    webPreferences: {
      preload: path.join(__dirname, "overlay-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep always on top even when other apps go fullscreen (macOS)
  overlayWindow.setAlwaysOnTop(true, "floating");
  // skipTransformProcessType: by default Electron turns the app into a UIElement app here,
  // which removes it from the Dock and Cmd+Tab (and it often never switches back).
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  watchWindowHealth(overlayWindow, "overlay");
  if (process.platform === "darwin" && !app.dock.isVisible()) app.dock.show();

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
  if (!gotSingleInstanceLock) return;

  // Request microphone permission on macOS (triggers system dialog on first run)
  if (process.platform === "darwin") {
    try {
      const micStatus = systemPreferences.getMediaAccessStatus("microphone");
      if (micStatus !== "granted") {
        await systemPreferences.askForMediaAccess("microphone");
      }
    } catch (err) {
      log.warn("Microphone permission request failed", { message: err.message });
    }
  }

  setupDownloads();
  setupNativeChrome();

  const port = await startServerOrExplain();
  if (port == null) return; // user chose Quit
  appPort = port;

  createMainWindow();
  if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });

  setupAutoUpdate();

  app.on("activate", () => {
    // The overlay may still be open, so check the main window itself
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  });
}).catch((err) => reportMainError("Node Trans failed to start", err));

// Start the local server. On failure, say exactly why and let the user retry, open the logs or quit.
async function startServerOrExplain() {
  for (;;) {
    try {
      const { startServer } = await import("../src/server.js");
      // Packaged app: a busy port falls back to a free one. In dev the Vite proxy expects 3333,
      // so fail loudly instead.
      return await startServer({ allowFallbackPort: !isDev });
    } catch (err) {
      log.error("Server failed to start", { message: err.message, code: err.code, stack: err.stack });
      const { response } = await dialog.showMessageBox({
        type: "error",
        title: "Node Trans",
        message: "Node Trans could not start",
        detail: `${err.message}\n\nLogs: ${LOGS_DIR}`,
        buttons: ["Try Again", "Open Logs Folder", "Quit"],
        defaultId: 0,
        cancelId: 2,
      });
      if (response === 1) shell.openPath(LOGS_DIR);
      if (response === 2) {
        app.quit();
        return null;
      }
    }
  }
}

// Window-level failures (renderer crash, page load failure, hang) — explain and offer a way out
function watchWindowHealth(win, name) {
  const wc = win.webContents;

  wc.on("render-process-gone", async (_e, details) => {
    if (details.reason === "clean-exit" || win.isDestroyed()) return;
    log.error(`${name} renderer gone`, details);
    if (name === "overlay") {
      reportMainError("The subtitle overlay stopped unexpectedly", new Error(`reason: ${details.reason}, exit code ${details.exitCode}`));
      win.destroy();
      return;
    }
    const { response } = await dialog.showMessageBox({
      type: "error",
      title: "Node Trans",
      message: "The window stopped unexpectedly",
      detail: `Reason: ${details.reason} (exit code ${details.exitCode}).\nYour sessions are saved.\n\nLogs: ${LOGS_DIR}`,
      buttons: ["Reload", "Quit"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0 && !win.isDestroyed()) wc.reload();
    else app.quit();
  });

  wc.on("did-fail-load", async (_e, code, description, url, isMainFrame) => {
    // -3 = ERR_ABORTED (navigation replaced by another one) — not a real failure
    if (!isMainFrame || code === -3 || win.isDestroyed()) return;
    log.error(`${name} failed to load`, { code, description, url });
    if (name === "overlay") {
      reportMainError("The subtitle overlay could not load", new Error(`${description} (${url})`));
      return;
    }
    const hint = isDev ? "\nIs the Vite dev server running (npm run dev:client)?" : "";
    // No parent window: the main window is still hidden until its first successful paint
    const { response } = await dialog.showMessageBox({
      type: "error",
      title: "Node Trans",
      message: "Couldn't load the interface",
      detail: `${description} (error ${code})\n${url}${hint}`,
      buttons: ["Try Again", "Quit"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0 && !win.isDestroyed()) wc.reload();
    else if (response === 1) app.quit();
  });

  win.on("unresponsive", async () => {
    if (name === "overlay" || win.isDestroyed()) return;
    log.warn(`${name} unresponsive`);
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      title: "Node Trans",
      message: "Node Trans is not responding",
      detail: "You can wait for it to recover or reload the window. Your sessions are saved.",
      buttons: ["Wait", "Reload"],
      defaultId: 0,
      cancelId: 0,
    });
    if (response === 1 && !win.isDestroyed()) wc.reload();
  });
}

// GPU / utility process crashes are recoverable — report, don't die
app.on("child-process-gone", (_e, details) => {
  if (details.reason === "clean-exit" || details.reason === "killed") return;
  log.error("Child process gone", details);
  reportMainError(`${details.type} process stopped`, new Error(`reason: ${details.reason}, exit code ${details.exitCode}`));
});

// Platform-native window chrome: inset traffic lights + sidebar vibrancy on macOS,
// Mica on Windows 11, plain opaque window on Linux.
function platformWindowOptions() {
  if (process.platform === "darwin") {
    return {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 22, y: 20 }, // inside the floating sidebar panel (8px inset)
      vibrancy: "sidebar",
      visualEffectState: "followWindow",
      backgroundColor: "#00000000",
    };
  }
  if (process.platform === "win32") {
    return { backgroundMaterial: "mica", autoHideMenuBar: true };
  }
  return { autoHideMenuBar: true };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 480,
    show: false,
    ...platformWindowOptions(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  watchWindowHealth(mainWindow, "main");
  mainWindow.webContents.on("did-finish-load", flushUiErrors);

  const sendFullscreen = (full) => () => mainWindow?.webContents.send("window:fullscreen", full);
  mainWindow.on("enter-full-screen", sendFullscreen(true));
  mainWindow.on("leave-full-screen", sendFullscreen(false));
  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.loadURL(isDev ? "http://localhost:5173" : `http://localhost:${appPort}`);
}

function sendMenuAction(id) {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  if (!win) return;
  if (id === "settings") win.show();
  win.webContents.send("menu:action", id);
}

function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const action = (label, id, accelerator) => ({ label, accelerator, click: () => sendMenuAction(id) });

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        action("Settings…", "settings", "Cmd+,"),
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    }] : []),
    {
      label: "File",
      submenu: [
        action("New Session", "new-session", "CmdOrCtrl+N"),
        { type: "separator" },
        action("Rename Session…", "rename"),
        action("Export…", "export", "CmdOrCtrl+E"),
        { type: "separator" },
        // No accelerator: Cmd+Backspace must keep deleting text in input fields
        action("Delete Session…", "delete"),
        ...(isMac ? [{ type: "separator" }, { role: "close" }] : [
          { type: "separator" },
          action("Settings…", "settings", "Ctrl+,"),
          { type: "separator" },
          { role: "quit" },
        ]),
      ],
    },
    { role: "editMenu" },
    {
      label: "Recording",
      submenu: [
        action("Start / Stop", "toggle-recording", "CmdOrCtrl+R"),
        action("Pause / Resume", "pause-resume", "CmdOrCtrl+Shift+P"),
      ],
    },
    {
      label: "View",
      submenu: [
        action("Toggle Sidebar", "toggle-sidebar", isMac ? "Ctrl+Cmd+S" : "Ctrl+B"),
        action("Show / Hide Overlay", "toggle-overlay", "CmdOrCtrl+Shift+O"),
        action("Find Session", "find", "CmdOrCtrl+F"),
        { type: "separator" },
        ...(isDev ? [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }] : []),
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getAccentHex() {
  try {
    const rgba = systemPreferences.getAccentColor?.();
    return rgba ? `#${rgba.slice(0, 6)}` : null;
  } catch {
    return null;
  }
}

function setupNativeChrome() {
  buildAppMenu();

  ipcMain.on("theme:set", (_e, mode) => {
    if (["system", "light", "dark"].includes(mode)) nativeTheme.themeSource = mode;
  });

  ipcMain.handle("accent:get", () => getAccentHex());
  const broadcastAccent = () => {
    const hex = getAccentHex();
    if (hex && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("accent:changed", hex);
  };
  if (process.platform === "darwin") {
    systemPreferences.subscribeNotification("AppleColorPreferencesChangedNotification", broadcastAccent);
  } else if (process.platform === "win32") {
    systemPreferences.on("accent-color-changed", broadcastAccent);
  }

  // Native context menu: renderer sends [{ id, label, disabled } | { type: "separator" }],
  // resolves with the clicked id or null when dismissed.
  ipcMain.handle("context-menu:show", (e, items) => new Promise((resolve) => {
    const menu = Menu.buildFromTemplate((items || []).map((item) =>
      item.type === "separator"
        ? { type: "separator" }
        : { label: String(item.label), enabled: !item.disabled, click: () => resolve(item.id) }
    ));
    menu.popup({
      window: BrowserWindow.fromWebContents(e.sender),
      // The close callback can run before the item's click handler; a promise only settles once,
      // so a late null is ignored when an item was picked.
      callback: () => setTimeout(() => resolve(null), 50),
    });
  }));
}

const DOWNLOAD_FILTERS = {
  docx: { name: "Word", extensions: ["docx"] },
  md: { name: "Markdown", extensions: ["md"] },
  txt: { name: "Text", extensions: ["txt"] },
  zip: { name: "Zip", extensions: ["zip"] },
};

// Session exports arrive as normal downloads; without a save path Electron prompts with this dialog
function setupDownloads() {
  session.defaultSession.on("will-download", (_e, item) => {
    const filter = DOWNLOAD_FILTERS[path.extname(item.getFilename()).slice(1).toLowerCase()];
    item.setSaveDialogOptions({
      defaultPath: path.join(app.getPath("downloads"), item.getFilename()),
      filters: filter ? [filter] : [],
    });
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

// Stop the server (ends active sessions in the DB) before quitting; give it 3s at most
let serverStopped = false;
app.on("before-quit", (e) => {
  // Nothing to stop when the server never started (second instance, startup failure)
  if (serverStopped || !appPort) return;
  e.preventDefault();
  serverStopped = true;
  const quit = () => app.quit();
  setTimeout(quit, 3000);
  import("../src/server.js")
    .then(({ stopServer }) => stopServer())
    .catch((err) => log.error("Stopping server on quit failed", { message: err.message }))
    .finally(quit);
});

// Ctrl+C / kill while running from a terminal: quit cleanly through before-quit
process.on("SIGINT", () => app.quit());
process.on("SIGTERM", () => app.quit());
