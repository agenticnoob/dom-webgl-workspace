// Recipe: a one-take page composed from the recipes in this folder.
//
// One camera rail runs through four chapters: intro reveal, particle form
// (sphere to the DOM word), CSS Grid gallery and product turntable, with a
// cell-dissolve veil at each hand-over. Copy the folder, then replace the
// image and model URLs, the copy and the camera path.
//
// - Page progress is one signal (`page`); chapter ranges are measured from the
//   `data-chapter` blocks after layout, never assumed from heights.
// - Lights and the environment sit outside every section.
// - `canvas.flat: false` gives the PBR product ACES tone mapping.
// - Requires @viselora/dom-webgl 0.3.0-alpha.0 or later (`WebGLSection`,
//   `useRenderQuality`, `useSectionState`).
import { useThree } from "@react-three/fiber";
import type { WebGLProgressSignalSource } from "@viselora/dom-webgl";
import { WebGLRuntime, WebGLTarget } from "@viselora/dom-webgl/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PMREMGenerator, type Vector3Tuple } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import {
  GalleryGrid,
  GalleryPlanes,
  createGalleryHoverStore,
  type GalleryItem,
} from "./GalleryReveal";
import { IntroReveal } from "./IntroReveal";
import { ChapterVeil, OneTakeRail } from "./OneTakeRail";
import { ParticleForm, sphereShape, textShape } from "./ParticleForm";
import {
  ProductHotspot,
  ProductTurntable,
  createHotspotStore,
  type Hotspot,
} from "./ProductTurntable";

const progressKey = "page";
const colors = { background: "#0b0c10", accent: "#f2a541", particles: "#9fb7ff" };
const wordId = "one-take-word";
const galleryId = "one-take-gallery";

// Module-level arrays: new arrays would rebuild the rail and shapes.
const shapes = [sphereShape(), textShape(wordId)];
const path: readonly Vector3Tuple[] = [
  [0, 0, 9],
  [0.8, 0.3, 7.6],
  [0, 0, 6.4],
  [0, 0.2, -12],
  [0, 0.6, -32.5],
  [3.4, 1.1, -35],
  [0, 1.8, -34],
];
const look: readonly Vector3Tuple[] = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, -30],
  [0, 0, -40],
  [0, 0, -40],
  [0, 0, -40],
];
const productStops = [0, 0.25, 0.5, 1];
const hotspots: readonly Hotspot[] = [
  { id: "top", point: [0, 0.36, 0] },
  { id: "side", point: [0.3, -0.18, 0.26] },
];
const gallery: readonly GalleryItem[] = [1, 2, 3, 4].map((index) => ({
  id: `card-${index}`,
  src: `/images/card-${index}.jpg`,
  reveal: `/images/card-${index}-alt.jpg`,
  alt: `Card ${index}`,
  caption: `Card / 0${index}`,
}));

type Range = { readonly key: string; readonly from: number; readonly to: number };
type Layout = {
  readonly form: Range;
  readonly product: Range;
  readonly boundaries: readonly number[];
};
const range = (from: number, to: number): Range => ({ key: progressKey, from, to });
const initialLayout: Layout = {
  form: range(0, 0.4),
  product: range(0.7, 1),
  boundaries: [0.4, 0.7],
};

const progressSignals: WebGLProgressSignalSource = {
  get: (key) => {
    if (key !== progressKey) return 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    return scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
  },
};

/** A chapter starts when its block's top reaches the middle of the viewport. */
function useMeasuredLayout() {
  const main = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState(initialLayout);
  useLayoutEffect(() => {
    const root = main.current;
    if (!root) return;
    const measure = () => {
      const scrollable = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const at = (offset: number) => Math.min(1, Math.max(0, offset / scrollable));
      const block = (name: string) =>
        root.querySelector<HTMLElement>(`[data-chapter="${name}"]`);
      const top = (name: string) =>
        (block(name)?.getBoundingClientRect().top ?? 0) + window.scrollY;
      const start = (name: string) => at(top(name) - window.innerHeight / 2);
      const product = block("product");
      const productEnd = product
        ? at(top("product") + product.offsetHeight - window.innerHeight)
        : 1;
      setLayout({
        form: range(0, start("gallery")),
        product: range(start("product"), productEnd),
        boundaries: [start("gallery"), start("product")],
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  return { main, layout };
}

function Environment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04).texture;
    room.dispose();
    generator.dispose();
    scene.environment = environment;
    return () => {
      if (scene.environment === environment) scene.environment = null;
      environment.dispose();
    };
  }, [gl, scene]);
  return null;
}

// Class names the recipes render; restyle freely. The page colour goes on the
// body: an opaque background on the DOM above the canvas would hide it.
const css = `
body { margin: 0; background: ${colors.background}; color: #ece8e1; }
.gallery-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
.gallery-card { margin: 0; }
.gallery-card img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.product-hotspots { position: fixed; inset: 0; z-index: 2; pointer-events: none; }
.product-hotspot { position: absolute; top: 0; left: 0; padding: 6px 10px; border-radius: 999px;
  background: rgba(11, 12, 16, 0.72); color: #ece8e1; white-space: nowrap; opacity: 0;
  transition: opacity 0.2s linear; }
@media (max-width: 720px) { .gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

export function OneTakeExample() {
  const [hover] = useState(createGalleryHoverStore);
  const [labels] = useState(createHotspotStore);
  const [revealing, setRevealing] = useState(false);
  const { main, layout } = useMeasuredLayout();
  useEffect(() => {
    // Particles are sampled on mount; give them a frame before the reveal.
    const timer = window.setTimeout(() => setRevealing(true), 300);
    return () => window.clearTimeout(timer);
  }, []);
  const block = (height: number) => ({ minHeight: `${height}vh`, padding: "0 8vw" });

  return (
    <WebGLRuntime
      canvas={{ camera: { fov: 45, near: 0.1, far: 200, position: path[0] }, flat: false }}
      progressSignals={progressSignals}
      scene={
        <>
          <OneTakeRail progressKey={progressKey} path={path} look={look} />
          <Environment />
          <ambientLight intensity={0.35} />
          <directionalLight position={[4, 6, 6]} intensity={1.6} />
          <ParticleForm
            progress={layout.form}
            shapes={shapes}
            color={colors.particles}
            accent={colors.accent}
          />
          <GalleryPlanes id={galleryId} items={gallery} hover={hover} />
          <ProductTurntable
            src="/models/product.glb"
            progress={layout.product}
            position={[0, 0, -40]}
            size={2.4}
            stops={productStops}
            hotspots={hotspots}
            store={labels}
            finish="studio"
          />
          <ChapterVeil
            progressKey={progressKey}
            boundaries={layout.boundaries}
            color={colors.background}
            accent={colors.accent}
          />
          <IntroReveal
            start={revealing}
            color={colors.background}
            accent={colors.accent}
          />
        </>
      }
    >
      <style>{css}</style>
      <main ref={main}>
        <section data-chapter="intro" style={block(120)}>
          <h1 style={{ margin: 0, paddingTop: "30vh" }}>One continuous shot.</h1>
        </section>
        <section data-chapter="form" style={block(240)}>
          <div style={{ position: "sticky", top: "20vh" }}>
            <h2>Points become a word.</h2>
            <WebGLTarget id={wordId}>
              <p style={{ margin: 0, fontSize: "clamp(40px, 7vw, 88px)", fontWeight: 700 }}>
                VISELORA
              </p>
            </WebGLTarget>
          </div>
        </section>
        <section data-chapter="gallery" style={block(200)}>
          <h2>The grid stays DOM.</h2>
          <GalleryGrid id={galleryId} items={gallery} hover={hover} />
        </section>
        <section data-chapter="product" style={block(300)}>
          <h2 style={{ position: "sticky", top: "14vh" }}>Turn it with the page.</h2>
          <div className="product-hotspots" aria-label="Product notes">
            <ProductHotspot store={labels} id="top">
              Top · cast in one piece
            </ProductHotspot>
            <ProductHotspot store={labels} id="side">
              Side · clear lacquer
            </ProductHotspot>
          </div>
        </section>
        <section data-chapter="outro" style={block(100)}>
          <h2>End of the shot.</h2>
        </section>
      </main>
    </WebGLRuntime>
  );
}
