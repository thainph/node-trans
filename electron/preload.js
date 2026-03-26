const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
});
