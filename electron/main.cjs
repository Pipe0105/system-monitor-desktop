const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const si = require("systeminformation");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.loadURL("http://localhost:5173");
}

ipcMain.handle("get-system-info", async () => {
  const cpu = await si.currentLoad();
  const mem = await si.mem();

  return {
    cpu: cpu.currentLoad.toFixed(1),
    ram: ((mem.used / mem.total) * 100).toFixed(1),
  };
});

app.whenReady().then(createWindow);
