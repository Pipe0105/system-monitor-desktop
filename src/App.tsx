import { useEffect, useMemo, useState } from "react";
import "./App.css";

type UsageSample = {
  timestamp: number;
  value: number;
};

const HISTORY_LIMIT = 60;
const INTERVAL_OPTIONS = [
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
];

const ALERT_THRESHOLD = 80;

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

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

function App() {
  const [cpu, setCpu] = useState(0);
  const [ram, setRam] = useState(0);
  const [disk, setDisk] = useState(0);
  const [cpuCores, setCpuCores] = useState<number[]>([]);
  const [cpuHistory, setCpuHistory] = useState<UsageSample[]>([]);
  const [ramHistory, setRamHistory] = useState<UsageSample[]>([]);
  const [diskHistory, setDiskHistory] = useState<UsageSample[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [intervalMs, setIntervalMs] = useState(INTERVAL_OPTIONS[0].value);

  useEffect(() => {
    const stored = window.localStorage.getItem("system-monitor-theme");
    if (stored) {
      setDarkMode(stored === "dark");
    }
    const storedInterval = window.localStorage.getItem(
      "system-monitor-interval"
    );
    if (storedInterval) {
      const parsed = Number(storedInterval);
      if (!Number.isNaN(parsed)) {
        setIntervalMs(parsed);
      }
    }
  }, []);

  useEffect(() => {
    const nextTheme = darkMode ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("system-monitor-theme", nextTheme);
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem("system-monitor-interval", String(intervalMs));

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
  const hasAlert = cpu >= ALERT_THRESHOLD;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Actualización en tiempo real</p>
          <h1>System Monitor</h1>
          <p className="subtitle">
            Últimos {HISTORY_LIMIT} segundos de actividad.
          </p>
        </div>
        <div className="header-controls">
          <label className="control-group">
            <span>Intervalo</span>
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
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
          >
            {darkMode ? "🌙 Modo oscuro" : "☀️ Modo claro"}
          </button>
        </div>
      </header>

      {hasAlert ? (
        <div className="alert" role="alert">
          Alerta: Cpu encima del {ALERT_THRESHOLD}% ({formatPercent(cpu)}
          %)
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
          <div className="history">
            {cpuHistory.map((sample) => (
              <span
                key={sample.timestamp}
                className="history-bar"
                style={{
                  height: `${sample.value}%`,
                  backgroundColor: cpuColor,
                }}
              />
            ))}
          </div>
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
          <div className="history">
            {ramHistory.map((sample) => (
              <span
                key={sample.timestamp}
                className="history-bar"
                style={{
                  height: `${sample.value}%`,
                  backgroundColor: ramColor,
                }}
              />
            ))}
          </div>
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
          <div className="history">
            {diskHistory.map((sample) => (
              <span
                key={sample.timestamp}
                className="history-bar"
                style={{
                  height: `${sample.value}%`,
                  backgroundColor: diskColor,
                }}
              />
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default App;
