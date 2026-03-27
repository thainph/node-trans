const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  toggleOverlay: (data) => ipcRenderer.send("overlay:toggle", data),
  sendOverlayData: (data) => ipcRenderer.send("overlay:data", data),
  sendOverlaySettings: (settings) => ipcRenderer.send("overlay:settings", settings),
  onOverlayClosed: (callback) => ipcRenderer.on("overlay:closed", () => callback()),
});
