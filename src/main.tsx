import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { applyTheme } from "./data/settings";
import "./styles/global.css";

// Тема ставится до первой отрисовки, иначе экран моргает светлым.
applyTheme();
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", applyTheme);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    {/* Адреса с # работают на любом хостинге без настройки перезаписи путей. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
