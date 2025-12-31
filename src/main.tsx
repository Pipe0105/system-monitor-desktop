import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const windowWithApi = window as Window & { api?: Window["api"] };

if (!windowWithApi.api) {
  windowWithApi.api = {
    getSystemInfo: async () => ({
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
    }),
    getAutoStartStatus: async () => ({
      enabled: false,
      available: false,
    }),
    setAutoStart: async () => ({
      enabled: false,
      available: false,
    }),
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
