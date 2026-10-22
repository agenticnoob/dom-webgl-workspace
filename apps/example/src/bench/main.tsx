import * as React from "react";
import { createRoot } from "react-dom/client";

import { BenchApp } from "./BenchApp";
import { readBenchOptions } from "./benchLayout";
import "./bench.css";

function mountBench() {
  const root = document.getElementById("root");
  if (!root) throw new Error("The benchmark page requires its root element.");
  createRoot(root).render(
    <React.StrictMode>
      <BenchApp options={readBenchOptions(window.location.search)} />
    </React.StrictMode>,
  );
}

if (typeof window !== "undefined" && typeof document !== "undefined")
  mountBench();
