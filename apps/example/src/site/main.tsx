import * as React from "react";
import { createRoot } from "react-dom/client";

import { readBenchOptions } from "../bench/benchLayout";
import "../bench/bench.css";
import "../fonts/site.css";
import { Site } from "./Site";
import "./site.css";

function mountSite() {
  const root = document.getElementById("root");
  if (!root) throw new Error("The site requires its root element.");
  const options = {
    ...readBenchOptions(window.location.search),
    bench: new URLSearchParams(window.location.search).get("bench") === "1",
  };
  createRoot(root).render(
    <React.StrictMode>
      <Site options={options} />
    </React.StrictMode>,
  );
}

if (typeof window !== "undefined" && typeof document !== "undefined")
  mountSite();
