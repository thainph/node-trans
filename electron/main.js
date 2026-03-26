import { app, BrowserWindow, systemPreferences } from "electron";
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
