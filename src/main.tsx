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
