import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import {
  DEFAULT_CONFIG,
  DEFAULT_CUSTOM_THEME,
  DEFAULT_METRIC_ORDER,
  HISTORY_WINDOW_MINUTES,
  HISTORY_WINDOW_MS,
  INTERVAL_OPTIONS,
  SHORTCUTS,
  buildAreaPath,
  buildChartPoints,
  buildLinePath,
  clampPercent,
  clampThreshold,
  formatMemory,
  formatPercent,
  getLoadColor,
  normalizeMetricOrder,
  pointsToString,
  safelyParseJSON,
} from "./core/monitoring";
import type {
  ChartPoint,
  CustomTheme,
  MetricCardId,
  NotificationChannels,
  ProcessInfo,
  ThemeMode,
  UsageSample,
} from "./core/monitoring";
import { getServices } from "./core/services";

type UsageChartProps = {
  samples: UsageSample[];
  color: string;
  label: string;
  tooltip?: string;
  eventMarkers?: ChartPoint[];
};

const UsageChart = ({
  samples,
  color,
  label,
  tooltip,
  eventMarkers = [],
}: UsageChartProps) => {
  const points = buildChartPoints(samples);
  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points);

  return (
    <div
      className="usage-chart"
      aria-label={`Histórico ${label}`}
      title={tooltip}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fill-${label}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {eventMarkers.map((point, index) => (
          <line
            key={`event-${label}-${index}`}
            className="usage-chart-event"
            x1={point.x}
            x2={point.x}
            y1={0}
            y2={100}
          />
        ))}
        <path
          className="usage-chart-area"
          d={areaPath}
          fill={`url(#fill-${label})`}
        />
        <path className="usage-chart-line" d={linePath} stroke={color} />
        <polyline
          className="usage-chart-points"
          points={pointsToString(points)}
          stroke={color}
        />
        {eventMarkers.map((point, index) => (
          <circle
            key={`event-dot-${label}-${index}`}
            className="usage-chart-event-dot"
            cx={point.x}
            cy={point.y}
            r={2}
          />
        ))}
      </svg>
      <div className="usage-chart-grid" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
};

function App() {
  const [cpu, setCpu] = useState(0);
  const [ram, setRam] = useState(0);
  const [disk, setDisk] = useState(0);
  const [cpuCores, setCpuCores] = useState<number[]>([]);
  const [cpuHistory, setCpuHistory] = useState<UsageSample[]>([]);
  const [ramHistory, setRamHistory] = useState<UsageSample[]>([]);
  const [diskHistory, setDiskHistory] = useState<UsageSample[]>([]);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const storedMode = window.localStorage.getItem("system-monitor-theme-mode");
    if (
      storedMode === "dark" ||
      storedMode === "light" ||
      storedMode === "custom"
    ) {
      return storedMode;
    }
    return "dark";
  });
  const [customTheme, setCustomTheme] = useState<CustomTheme>(() =>
    safelyParseJSON(
      window.localStorage.getItem("system-monitor-theme-custom"),
      DEFAULT_CUSTOM_THEME
    )
  );
  const [intervalMs, setIntervalMs] = useState(DEFAULT_CONFIG.intervalMs);
  const [cpuThreshold, setCpuThreshold] = useState(
    DEFAULT_CONFIG.thresholds.cpu
  );
  const [ramThreshold, setRamThreshold] = useState(
    DEFAULT_CONFIG.thresholds.ram
  );
  const [diskThreshold, setDiskThreshold] = useState(
    DEFAULT_CONFIG.thresholds.disk
  );
  const [settingsReady, setSettingsReady] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [autoStartAvailable, setAutoStartAvailable] = useState(false);
  const [layoutUnlocked, setLayoutUnlocked] = useState(
    safelyParseJSON(
      window.localStorage.getItem("system-monitor-layout-unlocked"),
      true
    )
  );
  const [metricOrder, setMetricOrder] = useState<MetricCardId[]>(() =>
    normalizeMetricOrder(
      safelyParseJSON(
        window.localStorage.getItem("system-monitor-metric-order"),
        DEFAULT_METRIC_ORDER
      ),
      DEFAULT_METRIC_ORDER
    )
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    safelyParseJSON(
      window.localStorage.getItem("system-monitor-notifications-enabled"),
      true
    )
  );
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(
    safelyParseJSON(
      window.localStorage.getItem("system-monitor-notification-sound"),
      false
    )
  );
  const [notificationCooldownMs, setNotificationCooldownMs] = useState(
    safelyParseJSON(
      window.localStorage.getItem("system-monitor-notification-cooldown"),
      DEFAULT_CONFIG.notification.cooldownMs
    )
  );
  const [notificationChannels, setNotificationChannels] = useState(() =>
    safelyParseJSON<NotificationChannels>(
      window.localStorage.getItem("system-monitor-notification-channels"),
      { cpu: true, ram: true, disk: true }
    )
  );
  const [shortcutsEnabled, setShortcutsEnabled] = useState(
    safelyParseJSON(
      window.localStorage.getItem("system-monitor-shortcuts-enabled"),
      true
    )
  );
  const fetchInFlight = useRef(false);
  const dragMetricId = useRef<MetricCardId | null>(null);
  const notificationState = useRef({ cpu: false, ram: false, disk: false });
  const notificationTimers = useRef({ cpu: 0, ram: 0, disk: 0 });
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const services = getServices();

  const appendSample = (
    previous: UsageSample[],
    value: number,
    timestamp: number
  ) =>
    [...previous, { timestamp, value }].filter(
      (sample) => sample.timestamp >= timestamp - HISTORY_WINDOW_MS
    );

  const calculateStats = (samples: UsageSample[]) => {
    if (samples.length === 0) {
      return { average: 0, peak: 0, latest: 0 };
    }

    const total = samples.reduce((sum, sample) => sum + sample.value, 0);
    const peak = samples.reduce(
      (max, sample) => Math.max(max, sample.value),
      0
    );
    const latest = samples[samples.length - 1]?.value ?? 0;

    return { average: total / samples.length, peak, latest };
  };

  const buildEventMarkers = (samples: UsageSample[], threshold: number) => {
    if (samples.length === 0) {
      return [];
    }

    const lastIndex = Math.max(samples.length - 1, 1);

    return samples.reduce<ChartPoint[]>((markers, sample, index) => {
      if (sample.value >= threshold) {
        markers.push({
          x: (index / lastIndex) * 100,
          y: 100 - clampPercent(sample.value),
        });
      }
      return markers;
    }, []);
  };

  const applyThemeVariables = useCallback(
    (mode: ThemeMode, theme: CustomTheme) => {
      const root = document.documentElement;
      root.dataset.theme = mode;
      if (mode === "custom") {
        root.style.setProperty("--bg", theme.bg);
        root.style.setProperty("--panel", theme.panel);
        root.style.setProperty("--text", theme.text);
        root.style.setProperty("--muted", theme.muted);
        root.style.setProperty("--border", theme.border);
        root.style.setProperty("--accent", theme.accent);
      } else {
        ["bg", "panel", "text", "muted", "border", "accent"].forEach((token) =>
          root.style.removeProperty(`--${token}`)
        );
      }
    },
    []
  );

  const playNotificationSound = useCallback(() => {
    if (!notificationSoundEnabled) {
      return;
    }

    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);

      oscillator.onended = () => {
        audioContext.close();
      };
    } catch (error) {
      console.warn("No se pudo reproducir el sonido de alerta", error);
    }
  }, [notificationSoundEnabled]);

  const sendNotification = useCallback(
    (title: string, body: string) => {
      if (!("Notification" in window)) {
        return;
      }

      if (Notification.permission !== "granted") {
        return;
      }

      new Notification(title, { body });
      playNotificationSound();
    },
    [playNotificationSound]
  );

  const maybeNotify = useCallback(
    (metric: keyof NotificationChannels, value: number, threshold: number) => {
      if (!notificationsEnabled || !notificationChannels[metric]) {
        notificationState.current[metric] = value >= threshold;
        return;
      }

      const isAlert = value >= threshold;
      const wasAlert = notificationState.current[metric];
      notificationState.current[metric] = isAlert;

      if (!isAlert) {
        return;
      }

      const now = Date.now();
      const lastSent = notificationTimers.current[metric];
      if (!wasAlert || now - lastSent >= notificationCooldownMs) {
        const label = metric.toUpperCase();
        sendNotification(
          `Alerta ${label}`,
          `${label} superó el ${threshold}% (ahora ${formatPercent(value)}%).`
        );
        notificationTimers.current[metric] = now;
      }
    },
    [
      notificationChannels,
      notificationCooldownMs,
      notificationsEnabled,
      sendNotification,
    ]
  );

  const fetchStats = useCallback(async () => {
    if (fetchInFlight.current) {
      return;
    }

    fetchInFlight.current = true;
    try {
      const data = await services.systemInfo.getSystemInfo();
      const nextCpu = clampPercent(Number(data.cpu));
      const nextRam = clampPercent(Number(data.ram));
      const nextDisk = clampPercent(Number(data.disk));
      const timestamp = Date.now();

      setCpu(nextCpu);
      setRam(nextRam);
      setDisk(nextDisk);
      setCpuCores(data.cpuCores.map((value) => clampPercent(value)));
      setCpuHistory((previous) => appendSample(previous, nextCpu, timestamp));
      setRamHistory((previous) => appendSample(previous, nextRam, timestamp));
      setDiskHistory((previous) => appendSample(previous, nextDisk, timestamp));
      const nextProcesses = (data.processes ?? []).map((process) => ({
        ...process,
        cpu: clampPercent(process.cpu),
        mem: clampPercent(process.mem),
      }));
      setProcesses(nextProcesses);

      maybeNotify("cpu", nextCpu, cpuThreshold);
      maybeNotify("ram", nextRam, ramThreshold);
      maybeNotify("disk", nextDisk, diskThreshold);
    } catch (error) {
      console.error("No se pudo obtener las métricas del sistema", error);
    } finally {
      fetchInFlight.current = false;
    }
  }, [cpuThreshold, ramThreshold, diskThreshold, maybeNotify, services]);

  useEffect(() => {
    const stored = window.localStorage.getItem("system-monitor-theme");
    if (stored === "light" || stored === "dark" || stored === "custom") {
      setThemeMode(stored);
    }
    const loadConfig = async () => {
      const config = await services.config.getConfig();
      setIntervalMs(config.intervalMs);
      setCpuThreshold(config.thresholds?.cpu ?? DEFAULT_CONFIG.thresholds.cpu);
      setRamThreshold(config.thresholds?.ram ?? DEFAULT_CONFIG.thresholds.ram);
      setDiskThreshold(
        config.thresholds?.disk ?? DEFAULT_CONFIG.thresholds.disk
      );
      setSettingsReady(true);
    };

    loadConfig();
  }, [services]);

  useEffect(() => {
    services.autoStart.getAutoStartStatus().then((status) => {
      setAutoStartEnabled(status.enabled);
      setAutoStartAvailable(status.available);
    });
  }, [services]);

  useEffect(() => {
    applyThemeVariables(themeMode, customTheme);
    window.localStorage.setItem("system-monitor-theme", themeMode);
    window.localStorage.setItem("system-monitor-theme-mode", themeMode);
    window.localStorage.setItem(
      "system-monitor-theme-custom",
      JSON.stringify(customTheme)
    );
  }, [applyThemeVariables, customTheme, themeMode]);

  useEffect(() => {
    window.localStorage.setItem(
      "system-monitor-layout-unlocked",
      JSON.stringify(layoutUnlocked)
    );
  }, [layoutUnlocked]);

  useEffect(() => {
    window.localStorage.setItem(
      "system-monitor-metric-order",
      JSON.stringify(metricOrder)
    );
  }, [metricOrder]);

  useEffect(() => {
    window.localStorage.setItem(
      "system-monitor-notifications-enabled",
      JSON.stringify(notificationsEnabled)
    );
  }, [notificationsEnabled]);

  useEffect(() => {
    window.localStorage.setItem(
      "system-monitor-notification-sound",
      JSON.stringify(notificationSoundEnabled)
    );
  }, [notificationSoundEnabled]);

  useEffect(() => {
    window.localStorage.setItem(
      "system-monitor-notification-cooldown",
      JSON.stringify(notificationCooldownMs)
    );
  }, [notificationCooldownMs]);

  useEffect(() => {
    window.localStorage.setItem(
      "system-monitor-notification-channels",
      JSON.stringify(notificationChannels)
    );
  }, [notificationChannels]);

  useEffect(() => {
    window.localStorage.setItem(
      "system-monitor-shortcuts-enabled",
      JSON.stringify(shortcutsEnabled)
    );
  }, [shortcutsEnabled]);

  useEffect(() => {
    if (settingsReady) {
      services.config.saveConfig({
        intervalMs,
        thresholds: {
          cpu: cpuThreshold,
          ram: ramThreshold,
          disk: diskThreshold,
        },
      });
    }
  }, [
    settingsReady,
    intervalMs,
    cpuThreshold,
    ramThreshold,
    diskThreshold,
    services,
  ]);

  useEffect(() => {
    services.metrics.setMetricsInterval(intervalMs);
  }, [intervalMs, services]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, intervalMs);

    return () => clearInterval(interval);
  }, [fetchStats, intervalMs]);

  const toggleNotifications = useCallback(async () => {
    const nextValue = !notificationsEnabled;
    setNotificationsEnabled(nextValue);

    if (!nextValue || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn("No se pudo solicitar permiso de notificaciones", error);
      }
    }
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!shortcutsEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (isTyping) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "t":
          setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
          break;
        case "r":
          fetchStats();
          break;
        case "l":
          setLayoutUnlocked((prev) => !prev);
          break;
        case "n":
          toggleNotifications();
          break;
        case "s":
          settingsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fetchStats, shortcutsEnabled, toggleNotifications]);

  const cpuColor = useMemo(() => getLoadColor(cpu), [cpu]);
  const ramColor = useMemo(() => getLoadColor(ram), [ram]);
  const diskColor = useMemo(() => getLoadColor(disk), [disk]);
  const cpuStats = useMemo(() => calculateStats(cpuHistory), [cpuHistory]);
  const ramStats = useMemo(() => calculateStats(ramHistory), [ramHistory]);
  const diskStats = useMemo(() => calculateStats(diskHistory), [diskHistory]);
  const cpuEventMarkers = useMemo(
    () => buildEventMarkers(cpuHistory, cpuThreshold),
    [cpuHistory, cpuThreshold]
  );
  const ramEventMarkers = useMemo(
    () => buildEventMarkers(ramHistory, ramThreshold),
    [ramHistory, ramThreshold]
  );

  const diskEventMarkers = useMemo(
    () => buildEventMarkers(diskHistory, diskThreshold),
    [diskHistory, diskThreshold]
  );

  const topCpuProcesses = useMemo(
    () => [...processes].sort((a, b) => b.cpu - a.cpu).slice(0, 5),
    [processes]
  );
  const topRamProcesses = useMemo(
    () => [...processes].sort((a, b) => b.mem - a.mem).slice(0, 5),
    [processes]
  );
  const alerts = [
    cpu >= cpuThreshold
      ? `CPU encima del ${cpuThreshold}% (${formatPercent(cpu)}%)`
      : null,
    ram >= ramThreshold
      ? `RAM encima del ${ramThreshold}% (${formatPercent(ram)}%)`
      : null,
    disk >= diskThreshold
      ? `Disco encima del ${diskThreshold}% (${formatPercent(disk)}%)`
      : null,
  ].filter(Boolean) as string[];

  const handleAutoStartToggle = async () => {
    const status = await services.autoStart.setAutoStart(!autoStartEnabled);
    setAutoStartEnabled(status.enabled);
    setAutoStartAvailable(status.available);
  };

  const handleThresholdChange =
    (setter: (value: number) => void) => (value: number) => {
      if (Number.isNaN(value)) {
        return;
      }
      setter(clampThreshold(value));
    };

  const handleRestoreDefaults = async () => {
    const config = await services.config.resetConfig();
    setIntervalMs(config.intervalMs);
    setCpuThreshold(config.thresholds?.cpu ?? DEFAULT_CONFIG.thresholds.cpu);
    setRamThreshold(config.thresholds?.ram ?? DEFAULT_CONFIG.thresholds.ram);
    setDiskThreshold(config.thresholds?.disk ?? DEFAULT_CONFIG.thresholds.disk);
  };

  const handleMetricDragStart = (id: MetricCardId) => {
    if (!layoutUnlocked) {
      return;
    }
    dragMetricId.current = id;
  };

  const handleMetricDrop = (id: MetricCardId) => {
    if (!layoutUnlocked) {
      return;
    }

    const dragged = dragMetricId.current;
    dragMetricId.current = null;
    if (!dragged || dragged === id) {
      return;
    }

    setMetricOrder((prev) => {
      const next = prev.filter((item) => item !== dragged);
      const targetIndex = next.indexOf(id);
      next.splice(targetIndex, 0, dragged);
      return next;
    });
  };

  const handleMetricDragOver = (event: React.DragEvent) => {
    if (layoutUnlocked) {
      event.preventDefault();
    }
  };

  const handleThemeModeChange = (value: ThemeMode) => {
    setThemeMode(value);
  };

  const handleCustomThemeChange = (key: keyof CustomTheme, value: string) => {
    setCustomTheme((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleChannelToggle = (channel: keyof NotificationChannels) => {
    setNotificationChannels((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  };

  const renderMetricCard = (id: MetricCardId) => {
    switch (id) {
      case "cpu":
        return (
          <article
            key="cpu"
            className={`metric-card ${
              layoutUnlocked ? "layout-draggable" : ""
            }`}
            draggable={layoutUnlocked}
            onDragStart={() => handleMetricDragStart("cpu")}
            onDragOver={handleMetricDragOver}
            onDrop={() => handleMetricDrop("cpu")}
          >
            <div className="metric-header">
              <div className="metric-title">
                <span className="drag-handle" aria-hidden="true">
                  ⠿
                </span>
                <h2>CPU</h2>
              </div>
              <span
                className="metric-pill"
                style={{ backgroundColor: cpuColor }}
              >
                {formatPercent(cpu)}%
              </span>
            </div>
            <div className="metric-stats">
              <div className="metric-stat">
                <span>Promedio</span>
                <strong>{formatPercent(cpuStats.average)}%</strong>
              </div>
              <div className="metric-stat">
                <span>Pico</span>
                <strong>{formatPercent(cpuStats.peak)}%</strong>
              </div>
            </div>
            <div className="metric-bar">
              <span
                className="metric-bar-fill"
                style={{ width: `${cpu}%`, backgroundColor: cpuColor }}
              />
            </div>
            <UsageChart
              samples={cpuHistory}
              color={cpuColor}
              label="cpu"
              eventMarkers={cpuEventMarkers}
              tooltip={`CPU ${formatPercent(
                cpuStats.latest
              )}% · Promedio ${formatPercent(
                cpuStats.average
              )}% · Pico ${formatPercent(
                cpuStats.peak
              )}% · Últimos ${HISTORY_WINDOW_MINUTES} min`}
            />
          </article>
        );
      case "cores":
        return (
          <article
            key="cores"
            className={`metric-card ${
              layoutUnlocked ? "layout-draggable" : ""
            }`}
            draggable={layoutUnlocked}
            onDragStart={() => handleMetricDragStart("cores")}
            onDragOver={handleMetricDragOver}
            onDrop={() => handleMetricDrop("cores")}
          >
            <div className="metric-header">
              <div className="metric-title">
                <span className="drag-handle" aria-hidden="true">
                  ⠿
                </span>
                <h2>CPU por núcleo</h2>
              </div>
              <span
                className="metric-pill"
                style={{ backgroundColor: cpuColor }}
              >
                {cpuCores.length} núcleos
              </span>
            </div>
            <div className="core-grid">
              {cpuCores.map((coreValue, index) => {
                const coreColor = getLoadColor(coreValue);
                return (
                  <div key={`core-${index}`} className="core-card">
                    <div className="core-header">
                      <span>Núcleo {index + 1}</span>
                      <strong>{formatPercent(coreValue)}%</strong>
                    </div>
                    <div className="metric-bar">
                      <span
                        className="metric-bar-fill"
                        style={{
                          width: `${coreValue}%`,
                          backgroundColor: coreColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      case "ram":
        return (
          <article
            key="ram"
            className={`metric-card ${
              layoutUnlocked ? "layout-draggable" : ""
            }`}
            draggable={layoutUnlocked}
            onDragStart={() => handleMetricDragStart("ram")}
            onDragOver={handleMetricDragOver}
            onDrop={() => handleMetricDrop("ram")}
          >
            <div className="metric-header">
              <div className="metric-title">
                <span className="drag-handle" aria-hidden="true">
                  ⠿
                </span>
                <h2>RAM</h2>
              </div>
              <span
                className="metric-pill"
                style={{ backgroundColor: ramColor }}
              >
                {formatPercent(ram)}%
              </span>
            </div>
            <div className="metric-stats">
              <div className="metric-stat">
                <span>Promedio</span>
                <strong>{formatPercent(ramStats.average)}%</strong>
              </div>
              <div className="metric-stat">
                <span>Pico</span>
                <strong>{formatPercent(ramStats.peak)}%</strong>
              </div>
            </div>
            <div className="metric-bar">
              <span
                className="metric-bar-fill"
                style={{ width: `${ram}%`, backgroundColor: ramColor }}
              />
            </div>
            <UsageChart
              samples={ramHistory}
              color={ramColor}
              label="ram"
              eventMarkers={ramEventMarkers}
              tooltip={`RAM ${formatPercent(
                ramStats.latest
              )}% · Promedio ${formatPercent(
                ramStats.average
              )}% · Pico ${formatPercent(
                ramStats.peak
              )}% · Últimos ${HISTORY_WINDOW_MINUTES} min`}
            />
          </article>
        );
      case "disk":
        return (
          <article
            key="disk"
            className={`metric-card ${
              layoutUnlocked ? "layout-draggable" : ""
            }`}
            draggable={layoutUnlocked}
            onDragStart={() => handleMetricDragStart("disk")}
            onDragOver={handleMetricDragOver}
            onDrop={() => handleMetricDrop("disk")}
          >
            <div className="metric-header">
              <div className="metric-title">
                <span className="drag-handle" aria-hidden="true">
                  ⠿
                </span>
                <h2>Disco</h2>
              </div>
              <span
                className="metric-pill"
                style={{ backgroundColor: diskColor }}
              >
                {formatPercent(disk)}%
              </span>
            </div>
            <div className="metric-stats">
              <div className="metric-stat">
                <span>Promedio</span>
                <strong>{formatPercent(diskStats.average)}%</strong>
              </div>
              <div className="metric-stat">
                <span>Pico</span>
                <strong>{formatPercent(diskStats.peak)}%</strong>
              </div>
            </div>
            <div className="metric-bar">
              <span
                className="metric-bar-fill"
                style={{ width: `${disk}%`, backgroundColor: diskColor }}
              />
            </div>
            <UsageChart
              samples={diskHistory}
              color={diskColor}
              label="disk"
              eventMarkers={diskEventMarkers}
              tooltip={`Disco ${formatPercent(
                diskStats.latest
              )}% · Promedio ${formatPercent(
                diskStats.average
              )}% · Pico ${formatPercent(
                diskStats.peak
              )}% · Últimos ${HISTORY_WINDOW_MINUTES} min`}
            />
          </article>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Actualización en tiempo real</p>
          <h1>System Monitor</h1>
          <p className="subtitle">
            Últimos {HISTORY_WINDOW_MINUTES} min de actividad.
          </p>
        </div>
        <div className="header-controls">
          <label className="control-group toggle">
            <span>Auto-start Windows</span>
            <button
              type="button"
              className="toggle-button"
              onClick={handleAutoStartToggle}
              disabled={!autoStartAvailable}
              aria-pressed={autoStartEnabled}
            >
              {autoStartEnabled ? "Activo" : "Inactivo"}
            </button>
          </label>
          <button
            className="theme-toggle"
            type="button"
            onClick={() =>
              setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))
            }
          >
            {themeMode === "dark"
              ? "🌙 Modo oscuro"
              : themeMode === "light"
              ? "☀️ Modo claro"
              : "🎨 Tema personalizado"}
          </button>
        </div>
      </header>

      <p className="tray-hint">
        Minimiza la ventana para enviarla a la bandeja del sistema.
      </p>

      <section className="settings-panel" ref={settingsRef}>
        <div className="settings-header">
          <div>
            <p className="eyebrow">Configuración avanzada</p>
            <h2>Panel de ajustes</h2>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={handleRestoreDefaults}
          >
            Restaurar valores por defecto
          </button>
        </div>
        <div className="settings-sections">
          <div className="settings-card">
            <h3>Ajustes de medición</h3>
            <div className="settings-grid">
              <label className="settings-field">
                <span>Intervalo de actualización</span>
                <select
                  value={intervalMs}
                  onChange={(event) =>
                    setIntervalMs(Number(event.target.value))
                  }
                >
                  {INTERVAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Umbral CPU</span>
                <div className="settings-input">
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={cpuThreshold}
                    onChange={(event) =>
                      handleThresholdChange(setCpuThreshold)(
                        Number(event.target.value)
                      )
                    }
                  />
                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={cpuThreshold}
                    onChange={(event) =>
                      handleThresholdChange(setCpuThreshold)(
                        Number(event.target.value)
                      )
                    }
                  />
                  <span>%</span>
                </div>
              </label>
              <label className="settings-field">
                <span>Umbral RAM</span>
                <div className="settings-input">
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={ramThreshold}
                    onChange={(event) =>
                      handleThresholdChange(setRamThreshold)(
                        Number(event.target.value)
                      )
                    }
                  />
                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={ramThreshold}
                    onChange={(event) =>
                      handleThresholdChange(setRamThreshold)(
                        Number(event.target.value)
                      )
                    }
                  />
                  <span>%</span>
                </div>
              </label>
              <label className="settings-field">
                <span>Umbral Disco</span>
                <div className="settings-input">
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={diskThreshold}
                    onChange={(event) =>
                      handleThresholdChange(setDiskThreshold)(
                        Number(event.target.value)
                      )
                    }
                  />
                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={diskThreshold}
                    onChange={(event) =>
                      handleThresholdChange(setDiskThreshold)(
                        Number(event.target.value)
                      )
                    }
                  />
                  <span>%</span>
                </div>
              </label>
            </div>
          </div>

          <div className="settings-card">
            <h3>Temas</h3>
            <div className="settings-grid">
              <label className="settings-field">
                <span>Modo visual</span>
                <select
                  value={themeMode}
                  onChange={(event) =>
                    handleThemeModeChange(event.target.value as ThemeMode)
                  }
                >
                  <option value="dark">Oscuro</option>
                  <option value="light">Claro</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>
              {themeMode === "custom" ? (
                <div className="theme-grid">
                  <label className="theme-field">
                    <span>Fondo</span>
                    <input
                      type="color"
                      value={customTheme.bg}
                      onChange={(event) =>
                        handleCustomThemeChange("bg", event.target.value)
                      }
                    />
                  </label>
                  <label className="theme-field">
                    <span>Paneles</span>
                    <input
                      type="color"
                      value={customTheme.panel}
                      onChange={(event) =>
                        handleCustomThemeChange("panel", event.target.value)
                      }
                    />
                  </label>
                  <label className="theme-field">
                    <span>Texto</span>
                    <input
                      type="color"
                      value={customTheme.text}
                      onChange={(event) =>
                        handleCustomThemeChange("text", event.target.value)
                      }
                    />
                  </label>
                  <label className="theme-field">
                    <span>Secundario</span>
                    <input
                      type="color"
                      value={customTheme.muted}
                      onChange={(event) =>
                        handleCustomThemeChange("muted", event.target.value)
                      }
                    />
                  </label>
                  <label className="theme-field">
                    <span>Divisores</span>
                    <input
                      type="color"
                      value={customTheme.border}
                      onChange={(event) =>
                        handleCustomThemeChange("border", event.target.value)
                      }
                    />
                  </label>
                  <label className="theme-field">
                    <span>Acento</span>
                    <input
                      type="color"
                      value={customTheme.accent}
                      onChange={(event) =>
                        handleCustomThemeChange("accent", event.target.value)
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <div className="settings-card">
            <h3>Layout</h3>
            <div className="settings-grid">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={layoutUnlocked}
                  onChange={() => setLayoutUnlocked((prev) => !prev)}
                />
                <span>Desbloquear drag & resize</span>
              </label>
              <p className="settings-hint">
                Arrastra las tarjetas para reorganizarlas y ajusta su tamaño
                desde la esquina inferior.
              </p>
            </div>
          </div>

          <div className="settings-card">
            <h3>Notificaciones</h3>
            <div className="settings-grid">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={toggleNotifications}
                />
                <span>Activar notificaciones</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={notificationSoundEnabled}
                  onChange={() => setNotificationSoundEnabled((prev) => !prev)}
                  disabled={!notificationsEnabled}
                />
                <span>Reproducir sonido</span>
              </label>
              <label className="settings-field">
                <span>Enfriamiento</span>
                <div className="settings-input">
                  <input
                    type="range"
                    min={15000}
                    max={180000}
                    step={15000}
                    value={notificationCooldownMs}
                    onChange={(event) =>
                      setNotificationCooldownMs(Number(event.target.value))
                    }
                    disabled={!notificationsEnabled}
                  />
                  <input
                    type="number"
                    min={15000}
                    max={180000}
                    step={15000}
                    value={notificationCooldownMs}
                    onChange={(event) =>
                      setNotificationCooldownMs(Number(event.target.value))
                    }
                    disabled={!notificationsEnabled}
                  />
                  <span>ms</span>
                </div>
              </label>
              <div className="notification-channels">
                <span>Canales</span>
                <div>
                  <button
                    type="button"
                    className={`channel-pill ${
                      notificationChannels.cpu ? "active" : ""
                    }`}
                    onClick={() => handleChannelToggle("cpu")}
                    disabled={!notificationsEnabled}
                  >
                    CPU
                  </button>
                  <button
                    type="button"
                    className={`channel-pill ${
                      notificationChannels.ram ? "active" : ""
                    }`}
                    onClick={() => handleChannelToggle("ram")}
                    disabled={!notificationsEnabled}
                  >
                    RAM
                  </button>
                  <button
                    type="button"
                    className={`channel-pill ${
                      notificationChannels.disk ? "active" : ""
                    }`}
                    onClick={() => handleChannelToggle("disk")}
                    disabled={!notificationsEnabled}
                  >
                    Disco
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-card">
            <h3>Atajos de teclado</h3>
            <div className="settings-grid">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={shortcutsEnabled}
                  onChange={() => setShortcutsEnabled((prev) => !prev)}
                />
                <span>Habilitar atajos</span>
              </label>
              <ul className="shortcut-list">
                {SHORTCUTS.map((shortcut) => (
                  <li key={shortcut.keys}>
                    <kbd>{shortcut.keys}</kbd>
                    <span>{shortcut.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {alerts.length > 0 ? (
        <div className="alert" role="alert">
          <strong>Alerta:</strong>
          <ul>
            {alerts.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="metrics">
        {metricOrder.map((id) => renderMetricCard(id))}
      </section>

      <section className="processes-panel">
        <div className="processes-header">
          <div>
            <p className="eyebrow">Monitor por procesos</p>
            <h2>Procesos activos</h2>
            <p className="subtitle">
              Top 5 por CPU/RAM y detalle de los procesos más demandantes.
            </p>
          </div>
          <div className="processes-meta">
            <span>Actualización cada {intervalMs / 1000}s</span>
            <span>{processes.length} procesos en vista</span>
          </div>
        </div>

        <div className="processes-top">
          <div className="processes-card">
            <h3>Top CPU</h3>
            <ol>
              {topCpuProcesses.map((process) => (
                <li key={`top-cpu-${process.pid}`}>
                  <div>
                    <strong>{process.name}</strong>
                    <span>PID {process.pid}</span>
                  </div>
                  <span
                    className="pill"
                    style={{ color: getLoadColor(process.cpu) }}
                  >
                    {formatPercent(process.cpu)}%
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="processes-card">
            <h3>Top RAM</h3>
            <ol>
              {topRamProcesses.map((process) => (
                <li key={`top-ram-${process.pid}`}>
                  <div>
                    <strong>{process.name}</strong>
                    <span>PID {process.pid}</span>
                  </div>
                  <span
                    className="pill"
                    style={{ color: getLoadColor(process.mem) }}
                  >
                    {formatPercent(process.mem)}%
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="processes-table">
          <div className="processes-table-head">
            <span>Proceso</span>
            <span>PID</span>
            <span>CPU</span>
            <span>RAM</span>
            <span>Memoria</span>
          </div>
          {processes.map((process) => {
            const isHeavy =
              process.cpu >= cpuThreshold || process.mem >= ramThreshold;
            return (
              <div
                key={`process-${process.pid}`}
                className={`process-row${isHeavy ? " heavy" : ""}`}
              >
                <div className="process-name">
                  <strong>{process.name}</strong>
                  {isHeavy ? <span>⚠️ Alto consumo</span> : null}
                </div>
                <span>{process.pid}</span>
                <span style={{ color: getLoadColor(process.cpu) }}>
                  {formatPercent(process.cpu)}%
                </span>
                <span style={{ color: getLoadColor(process.mem) }}>
                  {formatPercent(process.mem)}%
                </span>
                <span>{formatMemory(process.memRss)}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default App;
