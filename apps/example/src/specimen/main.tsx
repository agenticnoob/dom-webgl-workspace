import * as React from "react";
import { createRoot } from "react-dom/client";

import { readBenchOptions } from "../bench/benchLayout";
import "../bench/bench.css";
import "../fonts/specimen.css";
import { Specimen } from "./Specimen";
import "./specimen.css";

function mountSpecimen() {
  const root = document.getElementById("root");
  if (!root) throw new Error("The specimen page requires its root element.");
  const options = {
    ...readBenchOptions(window.location.search),
    bench: new URLSearchParams(window.location.search).get("bench") === "1",
  };
  createRoot(root).render(
    <React.StrictMode>
      <Specimen options={options} />
    </React.StrictMode>,
  );
}

if (typeof window !== "undefined" && typeof document !== "undefined")
  mountSpecimen();
