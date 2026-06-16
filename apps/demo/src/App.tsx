import "@project/dom-webgl-runtime";

import "./demo.css";

export default function App() {
  return (
    <main className="demo-shell">
      <section className="demo-scene" aria-label="DOM WebGL demo scene">
        <p className="demo-kicker">DOM-first WebGL runtime</p>
        <h1>Author in the DOM. Compile to one WebGL scene.</h1>
        <div className="demo-target" data-demo-target="hero.surface">
          Hero surface placeholder
        </div>
      </section>
    </main>
  );
}
