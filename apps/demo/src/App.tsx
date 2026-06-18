import * as React from "react";
import { useState } from "react";
import type { WebGLDebugState } from "@project/dom-webgl-runtime";
import { WebGLRuntime, WebGLTarget } from "@project/dom-webgl-runtime/react";

import "./demo.css";
import { DebugPanel } from "./debugPanel";

export default function App() {
  const [debugState, setDebugState] = useState<WebGLDebugState>(createInitialDebugState);

  return (
    <main className="demo-shell">
      <WebGLRuntime className="demo-runtime" onDebugStateChange={setDebugState}>
        <WebGLTarget as="section" className="demo-scene" aria-label="DOM WebGL demo scene"
          webgl={{
            key: "demo.section",
            source: { kind: "snapshot", mode: "element" },
          }}>
          <header className="demo-header">
            <p className="demo-kicker">Phase 3 Demo</p>
            <h1>One runtime, five source categories, no internal imports.</h1>
            <p className="demo-summary">
              The DOM stays author-facing. The runtime compiles declared targets into a
              single WebGL scene.
            </p>
          </header>

          <div className="demo-grid">
            <WebGLTarget
              className="demo-card demo-card-surface"
              webgl={{
                key: "demo.surface",
                source: { kind: "snapshot", mode: "element" },
                // lifecycle: { hideWhenReady: false },
              }}
            >
              <p className="demo-label">Element snapshot</p>
              <strong>Surface target</strong>
              <span>Box paint and layout-driven fallback content.</span>
            </WebGLTarget>

            <WebGLTarget
              as="h2"
              className="demo-card demo-card-text"
              webgl={{
                key: "demo.text",
                source: { kind: "snapshot", mode: "text" },
                // lifecycle: { hideWhenReady: false },
              }}
            >
              Text snapshot target
            </WebGLTarget>

            <WebGLTarget
              as="img"
              className="demo-card demo-card-media"
              alt="Demo image target"
              src="/demo/image.png"
              webgl={{
                key: "demo.image",
                source: { kind: "image", src: "/demo/image.png" },
                // lifecycle: { hideWhenReady: false },
              }}
            />

            <WebGLTarget
              as="video"
              className="demo-card demo-card-media"
              controls
              loop
              muted
              playsInline
              src="/demo/video.mp4"
              webgl={{
                key: "demo.video",
                source: { kind: "video", src: "/demo/video.mp4" },
                // lifecycle: { hideWhenReady: false },
              }}
            />

            <WebGLTarget
              className="demo-card demo-card-model"
              webgl={{
                key: "demo.model",
                source: { kind: "model", format: "glb", src: "/models/hero.glb" },
                lifecycle: { hideWhenReady: true, hideMode: "subtree" },
              }}
            >
              <p className="demo-label">GLB model</p>
              <strong>/models/hero.glb</strong>
              <span>Anchor this panel to a model renderable in the shared scene.</span>
            </WebGLTarget>
          </div>

          <section className="demo-fidelity" aria-label="DOM fidelity targets">
            <WebGLTarget
              className="demo-fidelity-card demo-fidelity-card-surface"
              webgl={{
                key: "demo.fidelity.surface",
                source: { kind: "snapshot", mode: "element" },
              }}
            >
              <p className="demo-label">Fidelity surface</p>
              <strong>Rounded, bordered, shadowed CSS box</strong>
              <span>Opacity, radius, border, and one outer shadow.</span>
            </WebGLTarget>

            <WebGLTarget
              as="p"
              className="demo-fidelity-card demo-fidelity-card-text"
              webgl={{
                key: "demo.fidelity.text",
                source: { kind: "snapshot", mode: "text" },
              }}
            >
              Multi-line text snapshot with centered alignment and responsive line
              wrapping.
            </WebGLTarget>

            <WebGLTarget
              as="img"
              className="demo-fidelity-card demo-fidelity-card-media"
              alt="Responsive object-fit cover target"
              src="/demo/fidelity-cover.png"
              webgl={{
                key: "demo.fidelity.image",
                source: { kind: "image", src: "/demo/fidelity-cover.png" },
              }}
            />
          </section>

          <DebugPanel state={debugState} />
        </WebGLTarget>
      </WebGLRuntime>
    </main>
  );
}

function createInitialDebugState(): WebGLDebugState {
  return {
    targetCount: 0,
    renderableCount: 0,
    currentScrollMode: "page",
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
    targets: [],
  };
}
