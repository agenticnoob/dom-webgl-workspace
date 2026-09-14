import * as React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./example.css";

function mountApp() {
  const root = document.getElementById("root");
  if (!root) throw new Error("The example app requires its root element.");
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

if (typeof window !== "undefined" && typeof document !== "undefined")
  mountApp();
