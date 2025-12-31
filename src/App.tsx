import { useEffect, useMemo, useState } from "react";
import "./App.css";

type UsageSample = {
  timestamp: number;
  value: number;
};

const HISTORY_LIMIT = 60;

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
  const [cpuHistory, setCpuHistory] = useState<UsageSample[]>([]);
  const [ramHistory, setRamHistory] = useState<UsageSample[]>([]);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem("system-monitor-theme");
    if (stored) {
      setDarkMode(stored === "dark");
    }
  }, []);

  useEffect(() => {
    const nextTheme = darkMode ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("system-monitor-theme", nextTheme);
  }, [darkMode]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await window.api.getSystemInfo();
      const nextCpu = clampPercent(Number(data.cpu));
      const nextRam = clampPercent(Number(data.ram));
      const timestamp = Date.now();

      setCpu(nextCpu);
      setRam(nextRam);
      setCpuHistory((previous) =>
        [...previous, { timestamp, value: nextCpu }].slice(-HISTORY_LIMIT)
      );
      setRamHistory((previous) =>
        [...previous, { timestamp, value: nextRam }].slice(-HISTORY_LIMIT)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const cpuColor = useMemo(() => getLoadColor(cpu), [cpu]);
  const ramColor = useMemo(() => getLoadColor(ram), [ram]);

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
        <button
          className="theme-toggle"
          type="button"
          onClick={() => setDarkMode((prev) => !prev)}
        >
          {darkMode ? "🌙 Modo oscuro" : "☀️ Modo claro"}
        </button>
      </header>

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
      </section>
    </div>
  );
}

export default App;
