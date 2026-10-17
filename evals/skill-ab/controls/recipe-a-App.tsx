// Task A built from skills/viselora-dom-webgl/recipes/ModelTarget.tsx
// (run-controls.mjs copies the recipes into src/recipes/).
import { WebGLRuntime, WebGLTarget } from "@viselora/dom-webgl/react";
import { ModelTarget } from "./recipes/ModelTarget";

const section = { minHeight: "100vh", padding: "10vh 8vw", boxSizing: "border-box" } as const;

export function App() {
  return (
    <WebGLRuntime
      canvas={{ orthographic: true, camera: { position: [0, 0, 1000], near: 0.1, far: 4000 } }}
      scene={
        <>
          <ambientLight intensity={1.2} />
          <directionalLight position={[300, 400, 600]} intensity={2} />
          <ModelTarget targetId="model" url="/models/hero.glb" />
        </>
      }
    >
      <main>
        <section style={section}>
          <h1>Recipe product page</h1>
          <p>Scroll to the product.</p>
        </section>
        <section style={section}>
          <article data-testid="product-card" style={{ border: "1px solid #ccc", borderRadius: 16, maxWidth: 420, padding: 24 }}>
            <WebGLTarget id="model" hideWhenReady>
              <div data-testid="model-fallback" style={{ height: 280, display: "grid", placeItems: "center", background: "#eee" }}>
                Hero model preview
              </div>
            </WebGLTarget>
            <h2>Hero figure</h2>
            <p>A compact figure for the recipe page.</p>
            <a href="#buy">Buy now</a>
          </article>
        </section>
        <section style={section} id="buy">
          <h2>Details</h2>
          <p>More content.</p>
        </section>
      </main>
    </WebGLRuntime>
  );
}
