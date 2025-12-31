import type { MetricCardId } from "./monitoring";
import type { ProfileId } from "./profiles";

export type SystemInfo = {
  cpu: string;
  ram: string;
  disk: string;
  cpuCores: number[];
  processes: {
    pid: number;
    name: string;
    cpu: number;
    mem: number;
    memRss: number;
  }[];
};

export type Config = {
  intervalMs: number;
  thresholds: {
    cpu: number;
    ram: number;
    disk: number;
  };
  profileId?: ProfileId;
  layout?: {
    presetId?: string;
    metricOrder?: MetricCardId[];
  };
};

export type AutoStartStatus = {
  enabled: boolean;
  available: boolean;
};

export type SystemInfoService = {
  getSystemInfo: () => Promise<SystemInfo>;
};

export type ConfigService = {
  getConfig: () => Promise<Config>;
  saveConfig: (config: Config) => Promise<Config>;
  resetConfig: () => Promise<Config>;
};

export type AutoStartService = {
  getAutoStartStatus: () => Promise<AutoStartStatus>;
  setAutoStart: (enabled: boolean) => Promise<AutoStartStatus>;
};

export type MetricsService = {
  setMetricsInterval: (intervalMs: number) => Promise<{ intervalMs: number }>;
};

export type Services = {
  systemInfo: SystemInfoService;
  config: ConfigService;
  autoStart: AutoStartService;
  metrics: MetricsService;
};

let services: Services | null = null;

export const registerServices = (next: Services) => {
  services = next;
};

export const getServices = (): Services => {
  if (!services) {
    throw new Error("Services not registered");
  }
  return services;
};
