const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  toggleOverlay: (data) => ipcRenderer.send("overlay:toggle", data),
  sendOverlayData: (data) => ipcRenderer.send("overlay:data", data),
  sendOverlaySettings: (settings) => ipcRenderer.send("overlay:settings", settings),
  onOverlayClosed: (callback) => ipcRenderer.on("overlay:closed", () => callback()),
  // Native chrome
  setTheme: (mode) => ipcRenderer.send("theme:set", mode),
  getAccentColor: () => ipcRenderer.invoke("accent:get"),
  onAccentColorChange: (callback) => ipcRenderer.on("accent:changed", (_e, hex) => callback(hex)),
  onFullscreenChange: (callback) => ipcRenderer.on("window:fullscreen", (_e, full) => callback(full)),
  onMenuAction: (callback) => ipcRenderer.on("menu:action", (_e, id) => callback(id)),
  showContextMenu: (items) => ipcRenderer.invoke("context-menu:show", items),
  // Main-process errors to show in the UI: { message, detail? }
  onAppError: (callback) => ipcRenderer.on("app:error", (_e, payload) => callback(payload)),
});
