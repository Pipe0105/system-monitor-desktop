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

type ProcessInfo = {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  memRss: number;
};

const HISTORY_WINDOW_MINUTES = 10;
const HISTORY_WINDOW_MS = HISTORY_WINDOW_MINUTES * 60 * 1000;
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
const formatMemory = (bytes: number) => {
  if (!bytes) {
    return "0 MB";
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
};

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
      setCpuHistory((previous) => appendSample(previous, nextCpu, timestamp));
      setRamHistory((previous) => appendSample(previous, nextRam, timestamp));
      setDiskHistory((previous) => appendSample(previous, nextDisk, timestamp));
      const nextProcesses = (data.processes ?? []).map((process) => ({
        ...process,
        cpu: clampPercent(process.cpu),
        mem: clampPercent(process.mem),
      }));
      setProcesses(nextProcesses);
    };

    fetchStats();
    const interval = setInterval(fetchStats, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

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
          <UsageChart
            samples={diskHistory}
            color={diskColor}
            label="disk"
            tooltip={`Disco ${formatPercent(
              diskStats.latest
            )}% · Promedio ${formatPercent(
              diskStats.average
            )}% · Pico ${formatPercent(
              diskStats.peak
            )}% · Últimos ${HISTORY_WINDOW_MINUTES} min`}
          />
        </article>
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
