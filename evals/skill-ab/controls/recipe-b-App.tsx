// Task B built from skills/viselora-dom-webgl/recipes/ScrollStory.tsx
// (run-controls.mjs copies the recipes into src/recipes/).
import { WebGLRuntime, WebGLTarget } from "@viselora/dom-webgl/react";
import { ScrollStoryScene } from "./recipes/ScrollStory";

const chapter = { minHeight: "100vh", padding: "20vh 8vw", boxSizing: "border-box" } as const;

export function App() {
  return (
    <WebGLRuntime
      canvas={{ camera: { position: [0, 0, 6], fov: 45 }, frameloop: "demand" }}
      scene={<ScrollStoryScene targetId="story" />}
    >
      <main>
        <WebGLTarget id="story">
          <div>
            {[1, 2, 3].map((n) => (
              <section key={n} data-testid={`chapter-${n}`} style={chapter}>
                <h2>Chapter {n}</h2>
                <p>The scene follows the reader.</p>
              </section>
            ))}
          </div>
        </WebGLTarget>
      </main>
    </WebGLRuntime>
  );
}
