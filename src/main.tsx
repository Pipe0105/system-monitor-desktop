import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { registerServices } from "./core/services";
import { LanguageProvider } from "./i18n/index.tsx";
import { createAppServices } from "./services/electronServices";

registerServices(createAppServices(window.api));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>
);
