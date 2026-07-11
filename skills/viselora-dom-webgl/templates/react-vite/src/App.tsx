import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { WebGLDeclaration } from "@viselora/dom-webgl";
import { WebGLTarget } from "@viselora/dom-webgl/react";
import {
  WebGLScrollRuntime,
  WebGLScrollTimeline,
} from "@viselora/scroll-adapters/react";

import { runtimeEffects } from "./effects";

gsap.registerPlugin(ScrollTrigger);

const imageDeclaration = {
  key: "story.product-image",
  source: {
    kind: "media",
    type: "image",
    src: "/media/product-source.svg",
  },
  pointer: { hover: true },
  timeline: {
    id: "story.product-progress",
    progressKey: "story.product-progress",
  },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "restore-dom" },
  },
  effects: [
    { kind: "story.imageHover" },
    { kind: "story.imageScroll", progressKey: "story.product-progress" },
  ],
} satisfies WebGLDeclaration;

export function App() {
  return (
    <WebGLScrollRuntime effects={runtimeEffects}>
      <main>
        <header className="hero">
          <p className="eyebrow">Viselora story template</p>
          <h1>A semantic page, enhanced by one managed canvas.</h1>
          <p>
            The document remains readable before assets load, when WebGL fails,
            and when reduced motion is preferred.
          </p>
        </header>

        <WebGLScrollTimeline
          id="story.product-progress"
          start="top bottom"
          end="bottom top"
          scrub
          ScrollTrigger={ScrollTrigger}
        >
          <section className="product-beat" aria-labelledby="product-title">
            <div>
              <p className="eyebrow">Beat 02</p>
              <h2 id="product-title">Hover, touch, or keep scrolling.</h2>
              <p>
                Hover adds a managed source-preserving treatment. Touch users
                and reduced-motion users receive the same message through copy
                and scroll progress, without hover-only meaning.
              </p>
            </div>
            <WebGLTarget as="figure" webgl={imageDeclaration}>
              <img
                src="/media/product-source.svg"
                alt="Layered cyan product study on a dark field"
              />
              <figcaption>Local CC0 demonstration artwork.</figcaption>
            </WebGLTarget>
          </section>
        </WebGLScrollTimeline>

        <section className="closing-beat">
          <p className="eyebrow">Beat 03–04</p>
          <h2>Evidence before polish.</h2>
          <p>
            Replace this copy and local asset only after the story plan,
            capability manifest, and browser assertions are complete.
          </p>
        </section>
      </main>
    </WebGLScrollRuntime>
  );
}
