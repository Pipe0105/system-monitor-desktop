interface Window {
  api: {
    getSystemInfo: () => Promise<{
      cpu: string;
      ram: string;
      disk: string;
      cpuCores: number[];
    }>;
  };
}
