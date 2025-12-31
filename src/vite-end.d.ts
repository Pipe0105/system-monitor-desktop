interface Window {
  api: {
    getSystemInfo: () => Promise<{
      cpu: string;
      ram: string;
      disk: string;
      cpuCores: number[];
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
