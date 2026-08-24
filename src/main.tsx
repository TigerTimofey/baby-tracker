import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { applyTheme } from "./data/settings";
import "./styles/global.css";

applyTheme();
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", applyTheme);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>

    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
