// Task C built from skills/viselora-dom-webgl/recipes/TextWave.tsx
// (run-controls.mjs copies the recipes into src/recipes/).
import { WebGLRuntime, WebGLTarget } from "@viselora/dom-webgl/react";
import { WaveText } from "./recipes/TextWave";

// line-height 1.5 is where createDOMTextTexture drifts ~22px; the recipe must not.
export function App() {
  return (
    <WebGLRuntime canvas={{ orthographic: true, camera: { position: [0, 0, 500] } }} scene={<WaveText targetId="wave" />}>
      <main>
        <section style={{ minHeight: "100vh", padding: "15vh 8vw" }}>
          <WebGLTarget id="wave" hideWhenReady>
            <h1 data-testid="wave-text" style={{ fontSize: "72px", lineHeight: 1.5, margin: 0 }}>
              Words that ripple through light
            </h1>
          </WebGLTarget>
          <p>Body copy stays in the DOM.</p>
        </section>
        <section style={{ minHeight: "100vh", padding: "15vh 8vw" }}>
          <h2>More</h2>
        </section>
      </main>
    </WebGLRuntime>
  );
}
