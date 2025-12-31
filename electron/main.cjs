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
    disk: 75,
  },
  profileId: "default",
  layout: {
    presetId: "default",
    metricOrder: ["cpu", "cores", "ram", "disk"],
  },
};

let mainWindow;
let tray;
let metricsIntervalMs = DEFAULT_CONFIG.intervalMs;
let metricsCache = { timestamp: 0, data: null };
let metricsInFlight = null;

const LOG_FILENAME = "system-monitor.log";
let logFilePath;
let logWriteQueue = Promise.resolve();

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const normalizeConfig = (config = {}) => {
  const thresholds = config.thresholds || {};
  const layout = config.layout || {};

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
      disk: clampNumber(
        thresholds.disk,
        20,
        100,
        DEFAULT_CONFIG.thresholds.disk
      ),
    },
    profileId:
      config.profileId === "default" ||
      config.profileId === "gaming" ||
      config.profileId === "work" ||
      config.profileId === "ahorro"
        ? config.profileId
        : DEFAULT_CONFIG.profileId,
    layout: {
      presetId:
        typeof layout.presetId === "string"
          ? layout.presetId
          : DEFAULT_CONFIG.layout.presetId,
      metricOrder: Array.isArray(layout.metricOrder)
        ? layout.metricOrder
        : DEFAULT_CONFIG.layout.metricOrder,
    },
  };
};

const getConfigPath = () => path.join(app.getPath("userData"), CONFIG_FILENAME);

const getLogFilePath = () => {
  if (!logFilePath) {
    const logDir = path.join(app.getPath("userData"), "logs");
    logFilePath = path.join(logDir, LOG_FILENAME);
  }
  return logFilePath;
};

const ensureLogDir = async () => {
  await fs.mkdir(path.dirname(getLogFilePath()), { recursive: true });
};

const writeLogLine = (line) => {
  logWriteQueue = logWriteQueue
    .then(async () => {
      await ensureLogDir();
      await fs.appendFile(getLogFilePath(), line, "utf8");
    })
    .catch((error) => {
      console.error("Failed to write log entry", error);
    });
};

const log = (level, message, meta = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const line = `${JSON.stringify(entry)}\n`;

  if (level === "error") {
    console.error(message, meta);
  } else {
    console.log(message, meta);
  }

  writeLogLine(line);
};

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

const buildSystemInfo = async () => {
  const [cpu, mem, disks, processData] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.processes(),
  ]);
  const totals = disks.reduce(
    (acc, disk) => {
      acc.used += disk.used || 0;
      acc.size += disk.size || 0;
      return acc;
    },
    { used: 0, size: 0 }
  );
  const diskUsage = totals.size > 0 ? (totals.used / totals.size) * 100 : 0;
  const processes = processData.list
    .map((process) => ({
      pid: process.pid,
      name: process.name,
      cpu: Number(process.cpu?.toFixed(1) ?? 0),
      mem: Number(process.mem?.toFixed(1) ?? 0),
      memRss: process.memRss || 0,
    }))
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 40);

  return {
    cpu: cpu.currentLoad.toFixed(1),
    ram: ((mem.used / mem.total) * 100).toFixed(1),
    disk: diskUsage.toFixed(1),
    cpuCores: cpu.cpus.map((core) => Number(core.load.toFixed(1))),
    processes,
  };
};

const getThrottleWindowMs = () =>
  clampNumber(metricsIntervalMs * 0.6, 250, 5000, 1000);

const getSystemInfo = async () => {
  const now = Date.now();
  if (
    metricsCache.data &&
    now - metricsCache.timestamp < getThrottleWindowMs()
  ) {
    return metricsCache.data;
  }

  if (metricsInFlight) {
    return metricsInFlight;
  }

  const snapshotPromise = buildSystemInfo()
    .then((data) => {
      metricsCache = { timestamp: Date.now(), data };
      return data;
    })
    .catch((error) => {
      log("error", "Fallo al obtener métricas del sistema", {
        error: error?.message ?? String(error),
      });
      if (metricsCache.data) {
        return metricsCache.data;
      }
      throw error;
    })
    .finally(() => {
      metricsInFlight = null;
    });

  metricsInFlight = snapshotPromise;
  return snapshotPromise;
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

  win.webContents.on("render-process-gone", (_event, details) => {
    log("error", "Render process gone", {
      reason: details.reason,
      exitCode: details.exitCode,
    });
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
  return getSystemInfo();
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

ipcMain.handle("set-metrics-interval", (_event, intervalMs) => {
  metricsIntervalMs = clampNumber(
    intervalMs,
    500,
    60000,
    DEFAULT_CONFIG.intervalMs
  );
  log("info", "Intervalo de métricas actualizado", {
    intervalMs: metricsIntervalMs,
  });
  return { intervalMs: metricsIntervalMs };
});

process.on("uncaughtException", (error) => {
  log("error", "Excepción no controlada", {
    error: error?.stack || error?.message || String(error),
  });
});

process.on("unhandledRejection", (reason) => {
  log("error", "Promesa rechazada sin controlar", {
    reason: reason?.stack || reason?.message || String(reason),
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.whenReady().then(async () => {
  if (isWindows) {
    app.setAppUserModelId("com.systemmonitor.desktop");
  }
  try {
    const config = await readConfig();
    metricsIntervalMs = config.intervalMs;
  } catch (error) {
    log("error", "No se pudo cargar la configuración inicial", {
      error: error?.message ?? String(error),
    });
  }
  mainWindow = createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (!isWindows) {
    app.quit();
  }
});
