interface Window {
  api: {
    getSystemInfo: () => Promise<{
      cpu: string;
      ram: string;
    }>;
  };
}
