// Recipe R6: the glyphs of a DOM heading assemble, hold and dissolve with
// scroll, and lean away from the pointer.
//
// The heading stays real DOM (semantic, selectable, readable without WebGL).
// Its glyphs are measured with measureDOMText, drawn once into an atlas with
// drawDOMText, and drawn as one instanced quad per glyph over the heading's
// box. Scroll progress through `progress` is a pure function of the scroll
// position: scattered → assembled (first 35%) → held → lifted and dissolved
// into grain (last 30%). A faint impression of every glyph stays at home, so
// glyphs fly into it and leave it behind, and the heading's box is never
// empty while its DOM text is hidden.
//
// Budget at medium: two draw calls (glyphs and impression); one atlas texture
// (glyph cells at up to 2× DPR); instances = visible characters.
//
// - Wrap the heading in `<WebGLTarget id hideWhenReady>`; the component is a
//   section over that target and reports ready once the atlas exists.
// - The atlas is rebuilt when the target's revision changes (fonts, resize,
//   content); the previous texture is disposed after the new one is in use.
// - Reduced motion: no scatter, lift or pointer push; the dissolve becomes a
//   fade.
import { useFrame } from "@react-three/fiber";
import { drawDOMText, measureDOMText } from "@viselora/dom-webgl";
import {
  WebGLSection,
  useDOMTarget,
  useRenderQuality,
  useWebGLRuntime,
  type WebGLSectionProgressRange,
} from "@viselora/dom-webgl/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  type Mesh,
  type ShaderMaterial,
} from "three";

import { cellHash, clamp01, coverRect, damp } from "./screenSpace";

export type GlyphScatterProps = {
  /** A registered `WebGLTarget` whose element holds the heading text. */
  readonly target: string;
  readonly progress: WebGLSectionProgressRange;
  /** How far glyphs start from home, in heading heights (default 0.9). */
  readonly spread?: number;
  /** Glyphs near the pointer tint toward this colour. */
  readonly accent?: string;
  /** Opacity of the impression left at home, 0..1 (default 0.08). */
  readonly impression?: number;
};

/**
 * Distance of the glyph plane from the camera. Depth offsets (scatter, lift,
 * pointer) are in world units, so a nearer plane would exaggerate them.
 */
const planeDistance = 4;
/** Extra atlas space around each glyph so overhanging ink is not clipped. */
const cellPadding = 0.25;
const maxGlyphs = 600;

type GlyphAtlas = {
  readonly texture: CanvasTexture;
  readonly geometry: InstancedBufferGeometry;
  /** Heading box in CSS pixels, for converting pointer positions. */
  readonly width: number;
  readonly height: number;
  dispose(): void;
};

/**
 * Draws each glyph of `element` into its own padded atlas cell and builds one
 * quad instance per visible glyph: `aRect` is its box in the heading's unit
 * square (x right, y up, centred), `aCell` its atlas rectangle in UV space.
 */
export function createGlyphAtlas(element: HTMLElement): GlyphAtlas | undefined {
  const layout = measureDOMText(element);
  const glyphs = layout.glyphs
    .filter((glyph) => glyph.char.trim() !== "")
    .slice(0, maxGlyphs);
  if (glyphs.length === 0) return undefined;
  const padX = layout.lineHeight * cellPadding;
  const padY = layout.lineHeight * cellPadding * 0.5;
  const cellWidth = Math.ceil(
    Math.max(...glyphs.map((glyph) => glyph.width)) + padX * 2,
  );
  const cellHeight = Math.ceil(layout.lineHeight + padY * 2);
  const columns = Math.ceil(Math.sqrt(glyphs.length));
  const rows = Math.ceil(glyphs.length / columns);
  const dpr = layout.devicePixelRatio;
  const canvas = element.ownerDocument.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(columns * cellWidth * dpr));
  canvas.height = Math.max(1, Math.ceil(rows * cellHeight * dpr));
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  // A glyph command translates to its line-box top; place each in its cell.
  drawDOMText(
    context,
    layout,
    glyphs.map((glyph, slot) => ({
      index: glyph.index,
      x: (slot % columns) * cellWidth + padX,
      y: Math.floor(slot / columns) * cellHeight + padY,
    })),
  );
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;

  const rects = new Float32Array(glyphs.length * 4);
  const cells = new Float32Array(glyphs.length * 4);
  const seeds = new Float32Array(glyphs.length * 2);
  const atlasWidth = columns * cellWidth;
  const atlasHeight = rows * cellHeight;
  glyphs.forEach((glyph, slot) => {
    const width = glyph.width + padX * 2;
    const height = layout.lineHeight + padY * 2;
    const left = glyph.x - padX;
    const top = glyph.y - padY;
    rects.set(
      [
        (left + width / 2) / layout.width - 0.5,
        0.5 - (top + height / 2) / layout.height,
        width / layout.width,
        height / layout.height,
      ],
      slot * 4,
    );
    const cellLeft = (slot % columns) * cellWidth;
    const cellTop = Math.floor(slot / columns) * cellHeight;
    cells.set(
      [
        cellLeft / atlasWidth,
        1 - (cellTop + height) / atlasHeight,
        width / atlasWidth,
        height / atlasHeight,
      ],
      slot * 4,
    );
    // Reading order spreads the stagger; the hash varies each glyph's path.
    seeds.set([slot / Math.max(1, glyphs.length - 1), hash(slot)], slot * 2);
  });
  const geometry = new InstancedBufferGeometry();
  const quad = new PlaneGeometry(1, 1);
  geometry.index = quad.index;
  geometry.setAttribute("position", quad.getAttribute("position"));
  geometry.setAttribute("uv", quad.getAttribute("uv"));
  geometry.setAttribute("aRect", new InstancedBufferAttribute(rects, 4));
  geometry.setAttribute("aCell", new InstancedBufferAttribute(cells, 4));
  geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 2));
  geometry.instanceCount = glyphs.length;
  let disposed = false;
  return {
    texture,
    geometry,
    width: layout.width,
    height: layout.height,
    dispose() {
      if (disposed) return;
      disposed = true;
      texture.dispose();
      geometry.dispose();
      quad.dispose();
    },
  };
}

function hash(value: number) {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Assembly and dissolve amounts for a local progress in 0..1. */
export function glyphPhase(local: number) {
  const smooth = (value: number) => value * value * (3 - 2 * value);
  return {
    assemble: smooth(clamp01(local / 0.35)),
    dissolve: smooth(clamp01((local - 0.7) / 0.3)),
  };
}

const glyphVertex = /* glsl */ `
uniform float uAssemble;
uniform float uDissolve;
uniform float uSpread;
uniform float uAspect;
uniform float uMotion;
uniform vec2 uPointer;
uniform float uPush;
attribute vec4 aRect;
attribute vec4 aCell;
attribute vec2 aSeed;
varying vec2 vUv;
varying vec2 vGrain;
varying float vOut;
varying float vNear;
varying float vIn;

float stagger(float amount, float order) {
  float t = clamp(amount * 1.6 - order * 0.6, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  float order = aSeed.x;
  float jitter = aSeed.y;
  float settled = stagger(uAssemble, order);
  float gone = stagger(uDissolve, order);
  vOut = gone;
  vIn = settled;

  // Scatter: a direction per glyph, wider sideways than up, and some depth.
  float angle = jitter * 6.2831853;
  vec2 away = vec2(cos(angle) * uSpread / uAspect, sin(angle) * uSpread * 0.6);
  float depth = (jitter - 0.5) * 2.0;
  float spin = (jitter - 0.5) * 2.4;

  vec2 center = aRect.xy;
  vec3 offset = vec3(away, depth) * (1.0 - settled) * uMotion;
  // Lift: drift up and toward the viewer while dissolving.
  offset += vec3(0.0, 0.05 + jitter * 0.08, 0.15) * gone * uMotion;

  // Pointer: glyphs near it lean out of the page and aside.
  vec2 toGlyph = (center - uPointer) * vec2(uAspect, 1.0);
  float near = uPush * smoothstep(0.9, 0.0, length(toGlyph));
  vNear = near;
  offset += vec3(normalize(toGlyph + 1e-4) * vec2(1.0 / uAspect, 1.0) * 0.08, 0.35) * near * uMotion;

  float rotation = spin * (1.0 - settled) * uMotion;
  vec2 local = position.xy * aRect.zw;
  local = mat2(cos(rotation), sin(rotation), -sin(rotation), cos(rotation)) * (local * vec2(uAspect, 1.0)) / vec2(uAspect, 1.0);
  vec3 p = vec3(center + local, 0.0) + offset;

  vUv = aCell.xy + uv * aCell.zw;
  vGrain = (center + position.xy * aRect.zw) * vec2(uAspect, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const glyphFragment = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uAccent;
uniform float uAssemble;
uniform float uGrain;
uniform float uMotion;
varying vec2 vUv;
varying vec2 vGrain;
varying float vOut;
varying float vNear;
varying float vIn;
${cellHash}
void main() {
  vec4 ink = texture2D(uAtlas, vUv);
  // Dissolve into grain: each cell of ink disappears once the glyph is this
  // far gone. Cell coordinates stay small so the hash keeps its precision.
  float grain = cellHash(mod(floor(vGrain * uGrain), 1024.0));
  float grains = vOut > 0.001 ? step(vOut, grain * 0.98) : 1.0;
  float keep = mix(1.0 - vOut, grains, uMotion);
  // Scattered glyphs stay faint until they near home.
  float arriving = mix(1.0, 0.2 + 0.8 * smoothstep(0.0, 0.7, vIn), uMotion);
  float alpha = ink.a * keep * arriving * mix(1.0, uAssemble, 1.0 - uMotion);
  // The atlas is not premultiplied: rgb is the glyph colour.
  vec3 color = mix(ink.rgb, uAccent, vNear * 0.85);
  gl_FragColor = vec4(color * alpha, alpha);
  #include <colorspace_fragment>
}`;

// The impression: every glyph at home, in its own colour, faint.
const impressionVertex = /* glsl */ `
attribute vec4 aRect;
attribute vec4 aCell;
varying vec2 vUv;
void main() {
  vUv = aCell.xy + uv * aCell.zw;
  vec3 p = vec3(aRect.xy + position.xy * aRect.zw, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const impressionFragment = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 ink = texture2D(uAtlas, vUv);
  float alpha = ink.a * uOpacity;
  gl_FragColor = vec4(ink.rgb * alpha, alpha);
  #include <colorspace_fragment>
}`;

const grainByTier = { high: 160, medium: 130, low: 90 } as const;

export function GlyphScatter(props: GlyphScatterProps) {
  return (
    <WebGLSection target={props.target} name="glyph-scatter">
      <GlyphField {...props} />
    </WebGLSection>
  );
}

function GlyphField({
  target: id,
  progress,
  spread = 0.9,
  accent = "#d7263d",
  impression = 0.08,
}: GlyphScatterProps) {
  const runtime = useWebGLRuntime();
  const target = useDOMTarget(id);
  const { tier, reducedMotion } = useRenderQuality();
  const mesh = useRef<Mesh>(null);
  const ghost = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const [revision, setRevision] = useState(-1);
  const atlas = useMemo(
    () =>
      revision >= 0 && target?.element
        ? createGlyphAtlas(target.element)
        : undefined,
    // `revision` is the rebuild signal; the element is read from the target.
    [revision, target],
  );
  // Dispose the previous atlas only after the new one is committed.
  useEffect(() => () => atlas?.dispose(), [atlas]);
  useEffect(() => {
    if (!target || !atlas) return;
    runtime.setTargetReady(id, true, target);
    return () => runtime.setTargetReady(id, false, target);
  }, [runtime, target, atlas, id]);

  const uniforms = useMemo(
    () => ({
      uAtlas: { value: atlas?.texture ?? null },
      uAssemble: { value: 0 },
      uDissolve: { value: 0 },
      uSpread: { value: spread },
      uAspect: { value: 1 },
      uMotion: { value: 1 },
      uPointer: { value: new Vector2(9, 9) },
      uPush: { value: 0 },
      uAccent: { value: new Color(accent) },
      uGrain: { value: grainByTier.medium },
    }),
    [atlas, spread, accent],
  );
  const impressionUniforms = useMemo(
    () => ({
      uAtlas: { value: atlas?.texture ?? null },
      uOpacity: { value: impression },
    }),
    [atlas, impression],
  );
  const pointer = useMemo(
    () => ({ raycaster: new Raycaster(), push: 0 }),
    [],
  );

  useFrame(({ camera, size, pointer: ndc }, delta) => {
    const live = target;
    if (live && live.revision !== revision) setRevision(live.revision);
    const node = mesh.current;
    const values = material.current?.uniforms;
    if (!node || !values || !live || !atlas || live.rect.width <= 0) return;
    coverRect(node, camera, live.rect, size, planeDistance);
    node.updateMatrixWorld();
    if (ghost.current)
      coverRect(ghost.current, camera, live.rect, size, planeDistance);
    const span = Math.max(1e-6, progress.to - progress.from);
    const local = clamp01(
      (runtime.progress.get(progress.key) - progress.from) / span,
    );
    const { assemble, dissolve } = glyphPhase(local);
    values.uAssemble.value = reducedMotion ? 1 : assemble;
    values.uDissolve.value = dissolve;
    values.uMotion.value = reducedMotion ? 0 : 1;
    values.uAspect.value = live.rect.width / Math.max(1, live.rect.height);
    values.uGrain.value = grainByTier[tier];

    // Pointer in the heading's unit square, via the plane it is drawn on.
    pointer.raycaster.setFromCamera(ndc, camera);
    const hits = pointer.raycaster.intersectObject(node, false);
    const hit = hits[0]?.uv;
    const inside = hit !== undefined && !reducedMotion;
    if (hit) values.uPointer.value.set(hit.x - 0.5, hit.y - 0.5);
    pointer.push = damp(pointer.push, inside ? 1 : 0, 0.18, delta);
    values.uPush.value = pointer.push;
  });

  if (!atlas) return null;
  return (
    <>
      <mesh
        ref={ghost}
        geometry={atlas.geometry}
        frustumCulled={false}
        renderOrder={-1}
      >
        <shaderMaterial
          uniforms={impressionUniforms}
          vertexShader={impressionVertex}
          fragmentShader={impressionFragment}
          transparent
          depthWrite={false}
          premultipliedAlpha
        />
      </mesh>
      <mesh ref={mesh} geometry={atlas.geometry} frustumCulled={false}>
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={glyphVertex}
          fragmentShader={glyphFragment}
          transparent
          depthWrite={false}
          premultipliedAlpha
        />
      </mesh>
    </>
  );
}
