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
  const disks = await si.fsSize();
  const totals = disks.reduce(
    (acc, disk) => {
      acc.used += disk.used || 0;
      acc.size += disk.size || 0;
      return acc;
    },
    { used: 0, size: 0 }
  );
  const diskUsage = totals.size > 0 ? (totals.used / totals.size) * 100 : 0;

  return {
    cpu: cpu.currentLoad.toFixed(1),
    ram: ((mem.used / mem.total) * 100).toFixed(1),
    disk: diskUsage.toFixed(1),
    cpuCores: cpu.cpus.map((core) => Number(core.load.toFixed(1))),
  };
});

app.whenReady().then(createWindow);
