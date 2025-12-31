import { useEffect, useMemo, useState } from "react";
import "./App.css";

type UsageSample = {
  timestamp: number;
  value: number;
};

type ChartPoint = {
  x: number;
  y: number;
};

const HISTORY_LIMIT = 60;
const INTERVAL_OPTIONS = [
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
];

const DEFAULT_CONFIG = {
  intervalMs: INTERVAL_OPTIONS[0].value,
  thresholds: {
    cpu: 80,
    ram: 80,
  },
};

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);
const clampThreshold = (value: number) => clampPercent(value);

const getLoadColor = (value: number) => {
  if (value < 50) {
    return "var(--success)";
  }
  if (value < 80) {
    return "var(--warning)";
  }
  return "var(--danger)";
};

const formatPercent = (value: number) => value.toFixed(1);

const buildChartPoints = (samples: UsageSample[]): ChartPoint[] => {
  if (samples.length === 0) {
    return [];
  }

  const lastIndex = Math.max(samples.length - 1, 1);
  return samples.map((sample, index) => ({
    x: (index / lastIndex) * 100,
    y: 100 - clampPercent(sample.value),
  }));
};

const pointsToString = (points: ChartPoint[]) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

const buildLinePath = (points: ChartPoint[]) =>
  points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
    )
    .join(" ");

const buildAreaPath = (points: ChartPoint[]) => {
  if (points.length === 0) {
    return "";
  }

  const linePath = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];

  return `${linePath} L ${last.x} 100 L ${first.x} 100 Z`;
};

type UsageChartProps = {
  samples: UsageSample[];
  color: string;
  label: string;
};

const UsageChart = ({ samples, color, label }: UsageChartProps) => {
  const points = buildChartPoints(samples);
  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points);

  return (
    <div className="usage-chart" aria-label={`Histórico ${label}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fill-${label}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
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
  const [darkMode, setDarkMode] = useState(true);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_CONFIG.intervalMs);
  const [cpuThreshold, setCpuThreshold] = useState(
    DEFAULT_CONFIG.thresholds.cpu
  );
  const [ramThreshold, setRamThreshold] = useState(
    DEFAULT_CONFIG.thresholds.ram
  );
  const [settingsReady, setSettingsReady] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [autoStartAvailable, setAutoStartAvailable] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("system-monitor-theme");
    if (stored) {
      setDarkMode(stored === "dark");
    }
    const loadConfig = async () => {
      if (!window.api.getConfig) {
        setSettingsReady(true);
        return;
      }

      const config = await window.api.getConfig();
      setIntervalMs(config.intervalMs);
      setCpuThreshold(config.thresholds.cpu);
      setRamThreshold(config.thresholds.ram);
      setSettingsReady(true);
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (window.api.getAutoStartStatus) {
      window.api.getAutoStartStatus().then((status) => {
        setAutoStartEnabled(status.enabled);
        setAutoStartAvailable(status.available);
      });
    }
  }, []);

  useEffect(() => {
    const nextTheme = darkMode ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("system-monitor-theme", nextTheme);
  }, [darkMode]);

  useEffect(() => {
    if (settingsReady && window.api.saveConfig) {
      window.api.saveConfig({
        intervalMs,
        thresholds: { cpu: cpuThreshold, ram: ramThreshold },
      });
    }
  }, [settingsReady, intervalMs, cpuThreshold, ramThreshold]);

  useEffect(() => {
    const fetchStats = async () => {
      const data = await window.api.getSystemInfo();
      const nextCpu = clampPercent(Number(data.cpu));
      const nextRam = clampPercent(Number(data.ram));
      const nextDisk = clampPercent(Number(data.disk));
      const timestamp = Date.now();

      setCpu(nextCpu);
      setRam(nextRam);
      setDisk(nextDisk);
      setCpuCores(data.cpuCores.map((value) => clampPercent(value)));
      setCpuHistory((previous) =>
        [...previous, { timestamp, value: nextCpu }].slice(-HISTORY_LIMIT)
      );
      setRamHistory((previous) =>
        [...previous, { timestamp, value: nextRam }].slice(-HISTORY_LIMIT)
      );
      setDiskHistory((previous) =>
        [...previous, { timestamp, value: nextDisk }].slice(-HISTORY_LIMIT)
      );
    };

    fetchStats();
    const interval = setInterval(fetchStats, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  const cpuColor = useMemo(() => getLoadColor(cpu), [cpu]);
  const ramColor = useMemo(() => getLoadColor(ram), [ram]);
  const diskColor = useMemo(() => getLoadColor(disk), [disk]);
  const alerts = [
    cpu >= cpuThreshold
      ? `CPU encima del ${cpuThreshold}% (${formatPercent(cpu)}%)`
      : null,
    ram >= ramThreshold
      ? `RAM encima del ${ramThreshold}% (${formatPercent(ram)}%)`
      : null,
  ].filter(Boolean) as string[];

  const handleAutoStartToggle = async () => {
    if (!window.api.setAutoStart) {
      return;
    }

    const status = await window.api.setAutoStart(!autoStartEnabled);
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
    if (window.api.resetConfig) {
      const config = await window.api.resetConfig();
      setIntervalMs(config.intervalMs);
      setCpuThreshold(config.thresholds.cpu);
      setRamThreshold(config.thresholds.ram);
      return;
    }

    setIntervalMs(DEFAULT_CONFIG.intervalMs);
    setCpuThreshold(DEFAULT_CONFIG.thresholds.cpu);
    setRamThreshold(DEFAULT_CONFIG.thresholds.ram);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Actualización en tiempo real</p>
          <h1>System Monitor</h1>
          <p className="subtitle">
            Últimas {HISTORY_LIMIT} muestras de actividad.
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
            onClick={() => setDarkMode((prev) => !prev)}
          >
            {darkMode ? "🌙 Modo oscuro" : "☀️ Modo claro"}
          </button>
        </div>
      </header>

      <p className="tray-hint">
        Minimiza la ventana para enviarla a la bandeja del sistema.
      </p>

      <section className="settings-panel">
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
        <div className="settings-grid">
          <label className="settings-field">
            <span>Intervalo de actualización</span>
            <select
              value={intervalMs}
              onChange={(event) => setIntervalMs(Number(event.target.value))}
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
        <article className="metric-card">
          <div className="metric-header">
            <h2>CPU</h2>
            <span className="metric-pill" style={{ backgroundColor: cpuColor }}>
              {formatPercent(cpu)}%
            </span>
          </div>
          <div className="metric-bar">
            <span
              className="metric-bar-fill"
              style={{ width: `${cpu}%`, backgroundColor: cpuColor }}
            />
          </div>
          <UsageChart samples={cpuHistory} color={cpuColor} label="cpu" />
        </article>

        <article className="metric-card">
          <div className="metric-header">
            <h2>CPU por núcleo</h2>
            <span className="metric-pill" style={{ backgroundColor: cpuColor }}>
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

        <article className="metric-card">
          <div className="metric-header">
            <h2>RAM</h2>
            <span className="metric-pill" style={{ backgroundColor: ramColor }}>
              {formatPercent(ram)}%
            </span>
          </div>
          <div className="metric-bar">
            <span
              className="metric-bar-fill"
              style={{ width: `${ram}%`, backgroundColor: ramColor }}
            />
          </div>
          <UsageChart samples={ramHistory} color={ramColor} label="ram" />
        </article>

        <article className="metric-card">
          <div className="metric-header">
            <h2>Disco</h2>
            <span
              className="metric-pill"
              style={{ backgroundColor: diskColor }}
            >
              {formatPercent(disk)}%
            </span>
          </div>
          <div className="metric-bar">
            <span
              className="metric-bar-fill"
              style={{ width: `${disk}%`, backgroundColor: diskColor }}
            />
          </div>
          <UsageChart samples={diskHistory} color={diskColor} label="disk" />
        </article>
      </section>
    </div>
  );
}

export default App;
