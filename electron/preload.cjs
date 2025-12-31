const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),
});
