// Recipe R3: DOM grid gallery with a cell hover reveal and scroll bend.
//
// CSS Grid lays out the cards; each card is a `WebGLTarget` whose image is
// replaced by a plane covering its box in front of the camera. Hovering a card
// reveals its second image cell by cell from the centre; fast scrolling bends
// the cards with scroll velocity.
//
// Budget at medium: one draw call per card in the section, two textures per
// card, 16×16 segments per plane.
//
// - `GalleryPlanes` is a section of the grid's own target, so offscreen cards
//   neither update nor draw. Its Suspense boundary is inside the section, so
//   loading images never suspends the section and warmup keeps running.
// - Images load with ImageBitmapLoader: decoded off the main thread and
//   flipped while decoding, so uploads are cheap. The loader cache owns the
//   bitmaps; each card owns and disposes its Texture.
// - The DOM image stays the accessible content; it is hidden only after the
//   plane is mounted with both textures.
// - Reduced motion: no bend, and the reveal becomes a crossfade.
import { useFrame, useLoader } from "@react-three/fiber";
import {
  WebGLSection,
  WebGLTarget,
  useDOMTarget,
  useRenderQuality,
  useWebGLRuntime,
} from "@viselora/dom-webgl/react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  ImageBitmapLoader,
  SRGBColorSpace,
  Texture,
  Vector2,
  type Mesh,
  type ShaderMaterial,
} from "three";

import { coverRect, damp } from "./screenSpace";

export type GalleryItem = {
  readonly id: string;
  readonly src: string;
  readonly reveal: string;
  readonly alt: string;
  readonly caption: string;
};

/** Shared between the DOM grid and the scene; mutated by pointer events. */
export type GalleryHoverStore = { readonly hovered: Set<string> };

export function createGalleryHoverStore(): GalleryHoverStore {
  return { hovered: new Set() };
}

export function GalleryGrid({
  id,
  items,
  hover,
}: {
  readonly id: string;
  readonly items: readonly GalleryItem[];
  readonly hover: GalleryHoverStore;
}) {
  return (
    <WebGLTarget id={id}>
      <div className="gallery-grid">
        {items.map((item) => (
          <figure
            key={item.id}
            className="gallery-card"
            onPointerEnter={() => hover.hovered.add(item.id)}
            onPointerLeave={() => hover.hovered.delete(item.id)}
          >
            <WebGLTarget id={item.id} hideWhenReady>
              <img src={item.src} alt={item.alt} draggable={false} />
            </WebGLTarget>
            <figcaption>{item.caption}</figcaption>
          </figure>
        ))}
      </div>
    </WebGLTarget>
  );
}

export function GalleryPlanes({
  id,
  items,
  hover,
  mount,
}: {
  readonly id: string;
  readonly items: readonly GalleryItem[];
  readonly hover: GalleryHoverStore;
  /** `"eager"` starts loading the images at page load (see WebGLSection). */
  readonly mount?: "near" | "eager";
}) {
  const runtime = useWebGLRuntime();
  // One velocity for every card, measured once per frame.
  const motion = useRef({ scrollY: Number.NaN, velocity: 0 });
  useFrame((_, delta) => {
    const { scrollY } = runtime.scroll;
    const state = motion.current;
    const raw =
      Number.isNaN(state.scrollY) || delta <= 0
        ? 0
        : (scrollY - state.scrollY) / delta / 4000;
    state.scrollY = scrollY;
    state.velocity = damp(
      state.velocity,
      Math.max(-1, Math.min(1, raw)),
      0.18,
      delta,
    );
  });
  return (
    <WebGLSection target={id} mount={mount}>
      {/* Inside the section: loading cards must not suspend the section itself. */}
      <Suspense fallback={null}>
        {items.map((item) => (
          <GalleryCard
            key={item.id}
            item={item}
            hover={hover}
            motion={motion}
          />
        ))}
      </Suspense>
    </WebGLSection>
  );
}

function useBitmapTexture(src: string) {
  const bitmap = useLoader(ImageBitmapLoader, src, (loader) => {
    loader.setOptions({ imageOrientation: "flipY" });
  });
  const texture = useMemo(() => {
    const created = new Texture(bitmap);
    created.flipY = false;
    created.colorSpace = SRGBColorSpace;
    created.needsUpdate = true;
    return created;
  }, [bitmap]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

const cardVertex = /* glsl */ `
uniform float uBend;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // A semicircular profile: the middle barely moves, the edges bend most.
  p.z -= uBend * (1.0 - cos((uv.y - 0.5) * 3.14159)) * 0.12;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const cardFragment = /* glsl */ `
uniform sampler2D uBase;
uniform sampler2D uReveal;
uniform float uHover;
uniform float uCells;
uniform float uReduced;
uniform vec2 uCardAspect;
uniform vec2 uBaseCover;
uniform vec2 uRevealCover;
varying vec2 vUv;

vec2 cover(vec2 uv, vec2 scale) {
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec4 base = texture2D(uBase, cover(vUv, uBaseCover));
  vec4 reveal = texture2D(uReveal, cover(vUv, uRevealCover));
  // Square cells in card space; each grows once the reveal radius passes it.
  vec2 grid = vec2(uCells, uCells * uCardAspect.y / uCardAspect.x);
  vec2 cell = floor(vUv * grid);
  vec2 local = fract(vUv * grid) - 0.5;
  vec2 center = (cell + 0.5) / grid - 0.5;
  float distance = length(center * uCardAspect / max(uCardAspect.x, uCardAspect.y));
  float size = clamp((uHover * 0.85 - distance) * 6.0, 0.0, 0.5);
  float mask = step(max(abs(local.x), abs(local.y)), size);
  mask = mix(mask, uHover, uReduced);
  gl_FragColor = mix(base, reveal, mask);
  #include <colorspace_fragment>
}`;

const cellsByTier = { high: 28, medium: 22, low: 16 } as const;

function GalleryCard({
  item,
  hover,
  motion,
}: {
  readonly item: GalleryItem;
  readonly hover: GalleryHoverStore;
  readonly motion: { readonly current: { readonly velocity: number } };
}) {
  const runtime = useWebGLRuntime();
  const target = useDOMTarget(item.id);
  const { tier, reducedMotion } = useRenderQuality();
  const base = useBitmapTexture(item.src);
  const reveal = useBitmapTexture(item.reveal);
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const hovered = useRef(0);
  const uniforms = useMemo(
    () => ({
      uBase: { value: base },
      uReveal: { value: reveal },
      uHover: { value: 0 },
      uBend: { value: 0 },
      uCells: { value: 22 },
      uReduced: { value: 0 },
      uCardAspect: { value: new Vector2(1, 1) },
      uBaseCover: { value: new Vector2(1, 1) },
      uRevealCover: { value: new Vector2(1, 1) },
    }),
    [base, reveal],
  );

  // Textures exist (the loader suspended until both decoded), so the plane can
  // replace the DOM image as soon as it is mounted.
  useEffect(() => {
    if (!target) return;
    runtime.setTargetReady(item.id, true, target);
    return () => runtime.setTargetReady(item.id, false, target);
  }, [runtime, target, item.id]);

  useFrame(({ camera, size }, delta) => {
    const node = mesh.current;
    const live = material.current?.uniforms;
    if (!node || !live || !target || target.rect.width <= 0) return;
    coverRect(node, camera, target.rect, size, 1);
    const { width, height } = target.rect;
    hovered.current = damp(
      hovered.current,
      hover.hovered.has(item.id) ? 1 : 0,
      reducedMotion ? 0.08 : 0.22,
      delta,
    );
    live.uHover.value = hovered.current;
    live.uBend.value = reducedMotion ? 0 : motion.current.velocity;
    live.uCells.value = cellsByTier[tier];
    live.uReduced.value = reducedMotion ? 1 : 0;
    live.uCardAspect.value.set(width, height);
    setCover(live.uBaseCover.value, width / height, base);
    setCover(live.uRevealCover.value, width / height, reveal);
  });

  return (
    <mesh ref={mesh} frustumCulled={false}>
      <planeGeometry args={[1, 1, 16, 16]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={cardVertex}
        fragmentShader={cardFragment}
      />
    </mesh>
  );
}

// object-fit: cover in UV space.
function setCover(scale: Vector2, cardAspect: number, texture: Texture) {
  const image: unknown = texture.image;
  const width =
    image && typeof image === "object" && "width" in image
      ? Number(image.width)
      : 1;
  const height =
    image && typeof image === "object" && "height" in image
      ? Number(image.height)
      : 1;
  const imageAspect = width / Math.max(1, height);
  if (cardAspect > imageAspect) scale.set(1, imageAspect / cardAspect);
  else scale.set(cardAspect / imageAspect, 1);
}
