interface Window {
  api: {
    getSystemInfo: () => Promise<{
      cpu: string;
      ram: string;
      disk: string;
      cpuCores: number[];
    }>;
    getConfig?: () => Promise<{
      intervalMs: number;
      thresholds: {
        cpu: number;
        ram: number;
      };
    }>;
    saveConfig?: (config: {
      intervalMs: number;
      thresholds: {
        cpu: number;
        ram: number;
      };
    }) => Promise<{
      intervalMs: number;
      thresholds: {
        cpu: number;
        ram: number;
      };
    }>;
    resetConfig?: () => Promise<{
      intervalMs: number;
      thresholds: {
        cpu: number;
        ram: number;
      };
    }>;
    getAutoStartStatus?: () => Promise<{
      enabled: boolean;
      available: boolean;
    }>;
    setAutoStart?: (enabled: boolean) => Promise<{
      enabled: boolean;
      available: boolean;
    }>;
  };
}
