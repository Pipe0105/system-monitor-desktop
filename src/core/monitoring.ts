import type { ProfileId } from "./profiles";

export type UsageSample = {
  timestamp: number;
  value: number;
};

export type ChartPoint = {
  x: number;
  y: number;
};

export type ProcessInfo = {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  memRss: number;
};

export type ThemeMode = "dark" | "light" | "custom";

export type CustomTheme = {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
};

export type NotificationChannels = {
  cpu: boolean;
  ram: boolean;
  disk: boolean;
};

export type MetricCardId = "cpu" | "cores" | "ram" | "disk";

export const HISTORY_WINDOW_MINUTES = 10;
export const HISTORY_WINDOW_MS = HISTORY_WINDOW_MINUTES * 60 * 1000;
export const INTERVAL_OPTIONS = [
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
];

export const DEFAULT_CONFIG = {
  intervalMs: INTERVAL_OPTIONS[0].value,
  thresholds: {
    cpu: 80,
    ram: 80,
    disk: 75,
  },
  profileId: "default" as ProfileId,
  layout: {
    presetId: "default",
    metricOrder: ["cpu", "cores", "ram", "disk"] as MetricCardId[],
  },
  notification: {
    cooldownMs: 60000,
  },
};

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  bg: "#101419",
  panel: "#1f2933",
  text: "#f5f7ff",
  muted: "#9aa3b2",
  border: "#2b3445",
  accent: "#6d28d9",
};

export const DEFAULT_METRIC_ORDER: MetricCardId[] = [
  "cpu",
  "cores",
  "ram",
  "disk",
];

export const SHORTCUTS = [
  { keys: "T", descriptionKey: "shortcuts.toggleTheme" },
  { keys: "R", descriptionKey: "shortcuts.refresh" },
  { keys: "L", descriptionKey: "shortcuts.toggleLayout" },
  { keys: "N", descriptionKey: "shortcuts.toggleNotifications" },
  { keys: "S", descriptionKey: "shortcuts.openSettings" },
];

export const clampPercent = (value: number) =>
  Math.min(Math.max(value, 0), 100);
export const clampThreshold = (value: number) => clampPercent(value);

export const getLoadColor = (value: number) => {
  if (value < 50) {
    return "var(--success)";
  }
  if (value < 80) {
    return "var(--warning)";
  }
  return "var(--danger)";
};

export const formatPercent = (value: number) => value.toFixed(1);
export const formatMemory = (bytes: number) => {
  if (!bytes) {
    return "0 MB";
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
};

export const buildChartPoints = (samples: UsageSample[]): ChartPoint[] => {
  if (samples.length === 0) {
    return [];
  }

  const lastIndex = Math.max(samples.length - 1, 1);
  return samples.map((sample, index) => ({
    x: (index / lastIndex) * 100,
    y: 100 - clampPercent(sample.value),
  }));
};

export const pointsToString = (points: ChartPoint[]) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

export const buildLinePath = (points: ChartPoint[]) =>
  points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
    )
    .join(" ");

export const buildAreaPath = (points: ChartPoint[]) => {
  if (points.length === 0) {
    return "";
  }

  const linePath = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];

  return `${linePath} L ${last.x} 100 L ${first.x} 100 Z`;
};

export const safelyParseJSON = <T>(value: string | null, fallback: T) => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("No se pudo leer la configuración almacenada", error);
    return fallback;
  }
};

export const normalizeMetricOrder = (
  stored: MetricCardId[],
  fallback: MetricCardId[]
) => {
  const uniqueStored = stored.filter(
    (item, index) => stored.indexOf(item) === index && fallback.includes(item)
  );
  const missing = fallback.filter((item) => !uniqueStored.includes(item));
  return [...uniqueStored, ...missing];
};
