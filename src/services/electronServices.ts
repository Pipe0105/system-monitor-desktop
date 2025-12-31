import { DEFAULT_CONFIG } from "../core/monitoring";
import type { Services } from "../core/services";

const fallbackSystemInfo = {
  cpu: "42.5",
  ram: "63.2",
  disk: "58.7",
  cpuCores: [35.2, 48.3, 52.1, 39.7],
  processes: [
    {
      pid: 424,
      name: "chrome.exe",
      cpu: 24.5,
      mem: 18.2,
      memRss: 820000000,
    },
    { pid: 992, name: "code.exe", cpu: 12.1, mem: 9.3, memRss: 520000000 },
    { pid: 1337, name: "slack.exe", cpu: 6.4, mem: 6.1, memRss: 310000000 },
    {
      pid: 2112,
      name: "spotify.exe",
      cpu: 3.9,
      mem: 4.8,
      memRss: 180000000,
    },
    {
      pid: 2560,
      name: "notion.exe",
      cpu: 2.3,
      mem: 3.6,
      memRss: 140000000,
    },
  ],
};

const resolveApi = (api?: Window["api"]) => api;

export const createAppServices = (api?: Window["api"]): Services => {
  const resolvedApi = resolveApi(api);

  return {
    systemInfo: {
      getSystemInfo: async () =>
        resolvedApi?.getSystemInfo
          ? resolvedApi.getSystemInfo()
          : fallbackSystemInfo,
    },
    config: {
      getConfig: async () =>
        resolvedApi?.getConfig ? resolvedApi.getConfig() : DEFAULT_CONFIG,
      saveConfig: async (config) =>
        resolvedApi?.saveConfig ? resolvedApi.saveConfig(config) : config,
      resetConfig: async () =>
        resolvedApi?.resetConfig ? resolvedApi.resetConfig() : DEFAULT_CONFIG,
    },
    autoStart: {
      getAutoStartStatus: async () =>
        resolvedApi?.getAutoStartStatus
          ? resolvedApi.getAutoStartStatus()
          : { enabled: false, available: false },
      setAutoStart: async (enabled) =>
        resolvedApi?.setAutoStart
          ? resolvedApi.setAutoStart(enabled)
          : { enabled: false, available: false },
    },
    metrics: {
      setMetricsInterval: async (intervalMs) =>
        resolvedApi?.setMetricsInterval
          ? resolvedApi.setMetricsInterval(intervalMs)
          : { intervalMs },
    },
  };
};
