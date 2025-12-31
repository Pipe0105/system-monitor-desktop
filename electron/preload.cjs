const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),
  getAutoStartStatus: () => ipcRenderer.invoke("get-auto-start-status"),
  setAutoStart: (enabled) => ipcRenderer.invoke("set-auto-start", enabled),
});
