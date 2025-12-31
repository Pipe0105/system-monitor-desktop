const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  resetConfig: () => ipcRenderer.invoke("reset-config"),
  getAutoStartStatus: () => ipcRenderer.invoke("get-auto-start-status"),
  setAutoStart: (enabled) => ipcRenderer.invoke("set-auto-start", enabled),
  setMetricsInterval: (intervalMs) =>
    ipcRenderer.invoke("set-metrics-interval", intervalMs),
});
