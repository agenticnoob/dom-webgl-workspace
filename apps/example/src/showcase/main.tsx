import * as React from "react";
import { createRoot } from "react-dom/client";

import { readBenchOptions } from "../bench/benchLayout";
import "../bench/bench.css";
import { Showcase } from "./Showcase";
import "./showcase.css";

function mountShowcase() {
  const root = document.getElementById("root");
  if (!root) throw new Error("The showcase requires its root element.");
  const options = {
    ...readBenchOptions(window.location.search),
    bench: new URLSearchParams(window.location.search).get("bench") === "1",
  };
  createRoot(root).render(
    <React.StrictMode>
      <Showcase options={options} />
    </React.StrictMode>,
  );
}

if (typeof window !== "undefined" && typeof document !== "undefined")
  mountShowcase();
