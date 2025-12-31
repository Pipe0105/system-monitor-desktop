const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} = require("electron");

const path = require("path");
const fs = require("fs/promises");
const si = require("systeminformation");

const isWindows = process.platform === "win32";
const isDev = !app.isPackaged;
const trayIcon = nativeImage.createFromPath(
  path.join(__dirname, "assets", "tray.png")
);

const CONFIG_FILENAME = "config.json";
const DEFAULT_CONFIG = {
  intervalMs: 1000,
  thresholds: {
    cpu: 80,
    ram: 80,
  },
};

let mainWindow;
let tray;

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const normalizeConfig = (config = {}) => {
  const thresholds = config.thresholds || {};

  return {
    intervalMs: clampNumber(
      config.intervalMs,
      500,
      60000,
      DEFAULT_CONFIG.intervalMs
    ),
    thresholds: {
      cpu: clampNumber(thresholds.cpu, 20, 100, DEFAULT_CONFIG.thresholds.cpu),
      ram: clampNumber(thresholds.ram, 20, 100, DEFAULT_CONFIG.thresholds.ram),
    },
  };
};

const getConfigPath = () => path.join(app.getPath("userData"), CONFIG_FILENAME);

const readConfig = async () => {
  try {
    const raw = await fs.readFile(getConfigPath(), "utf8");
    return normalizeConfig(JSON.parse(raw));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return DEFAULT_CONFIG;
    }
    return DEFAULT_CONFIG;
  }
};

const writeConfig = async (config) => {
  const normalized = normalizeConfig(config);
  await fs.writeFile(
    getConfigPath(),
    JSON.stringify(normalized, null, 2),
    "utf8"
  );
  return normalized;
};

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.on("minimize", (event) => {
    event.preventDefault();
    win.hide();
  });

  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

function createTray() {
  tray = new Tray(trayIcon);
  tray.setToolTip("System Monitor");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Mostrar",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "Salir",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
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

ipcMain.handle("get-config", async () => readConfig());

ipcMain.handle("save-config", async (_event, config) => writeConfig(config));

ipcMain.handle("reset-config", async () => writeConfig(DEFAULT_CONFIG));

ipcMain.handle("get-auto-start-status", () => {
  if (!isWindows) {
    return { enabled: false, available: false };
  }
  const settings = app.getLoginItemSettings();
  return { enabled: settings.openAtLogin, available: true };
});

ipcMain.handle("set-auto-start", (_event, enabled) => {
  if (!isWindows) {
    return { enabled: false, available: false };
  }
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  const settings = app.getLoginItemSettings();
  return { enabled: settings.openAtLogin, available: true };
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.whenReady().then(() => {
  if (isWindows) {
    app.setAppUserModelId("com.systemmonitor.desktop");
  }
  mainWindow = createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (!isWindows) {
    app.quit();
  }
});
