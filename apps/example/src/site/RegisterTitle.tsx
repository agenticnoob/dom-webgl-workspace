// Site hero: a DOM heading printed in two plates, like a two-colour riso print.
//
// The blue plate sits exactly where the DOM heading is. The pink plate starts
// out of register (offset, slightly turned, pulled by the pointer) and comes
// into register as the hero scrolls away; where the plates overlap they
// overprint to violet. Registration marks in the margin move with each plate.
//
// Budget: one draw call, one coverage mask drawn once with drawDOMText.
//
// - It is a target section; the DOM heading hides only once the mask exists.
// - Colours are composited against `paper` in the shader (subtractive inks on
//   a known page colour), so the canvas stays transparent.
// - Reduced motion: no drift and no pointer pull; registration follows scroll.
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
  LinearFilter,
  Vector2,
  Vector3,
  type Mesh,
  type ShaderMaterial,
} from "three";

import { cellHash, clamp01, coverRect, damp } from "../showcase/screenSpace";

/** DOM nodes the title writes its live offset into. */
export type RegisterStore = {
  readout: HTMLElement | null;
  status: HTMLElement | null;
};

export function createRegisterStore(): RegisterStore {
  return { readout: null, status: null };
}

export type RegisterTitleProps = {
  readonly target: string;
  /** Out of register at `from`, in register at `to`. */
  readonly progress: WebGLSectionProgressRange;
  readonly paper: string;
  readonly blue: string;
  readonly pink: string;
  readonly store?: RegisterStore;
  /** Status text for the two states. */
  readonly labels?: { readonly off: string; readonly on: string };
};

const planeDistance = 4;

type RegisterMask = {
  readonly texture: CanvasTexture;
  /** Quad size in CSS pixels, heading plus margin on each side. */
  readonly size: Vector2;
  readonly margin: number;
  dispose(): void;
};

/** The heading's coverage, drawn once with a margin for the marks. */
export function createRegisterMask(element: HTMLElement): RegisterMask | undefined {
  const layout = measureDOMText(element);
  const margin = Math.round(Math.min(56, Math.max(20, layout.height * 0.22)));
  const width = layout.width + margin * 2;
  const height = layout.height + margin * 2;
  const dpr = layout.devicePixelRatio;
  const canvas = element.ownerDocument.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * dpr));
  canvas.height = Math.max(1, Math.ceil(height * dpr));
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.setTransform(dpr, 0, 0, dpr, margin * dpr, margin * dpr);
  drawDOMText(context, layout);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  let disposed = false;
  return {
    texture,
    size: new Vector2(width, height),
    margin,
    dispose() {
      if (disposed) return;
      disposed = true;
      texture.dispose();
    },
  };
}

/** sRGB components as written in CSS; the shader composites in that space. */
export function cssRGB(hex: string) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return new Vector3(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  );
}

/** How far out of register the pink plate is for a local progress in 0..1. */
export function misregistration(local: number) {
  const t = clamp01(local);
  return 1 - t * t * (3 - 2 * t);
}

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform sampler2D uMask;
uniform vec2 uSize;
uniform float uMargin;
uniform vec2 uOffset;
uniform float uTurn;
uniform vec3 uPaper;
uniform vec3 uBlue;
uniform vec3 uPink;
uniform float uPixel;
varying vec2 vUv;
${cellHash}

float coverage(vec2 px) {
  vec2 uv = px / uSize;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture2D(uMask, uv).a;
}

// A registration target (ring and cross) centred in each corner of the margin.
float marks(vec2 px) {
  float inset = uMargin * 0.5;
  float radius = uMargin * 0.22;
  float arm = uMargin * 0.4;
  float line = uPixel * 0.75;
  float ink = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 corner = vec2(i == 1 || i == 3 ? uSize.x - inset : inset, i >= 2 ? uSize.y - inset : inset);
    vec2 d = px - corner;
    float ring = 1.0 - smoothstep(line, line + uPixel, abs(length(d) - radius));
    float bars = max(
      (1.0 - smoothstep(line, line + uPixel, abs(d.x))) * step(abs(d.y), arm),
      (1.0 - smoothstep(line, line + uPixel, abs(d.y))) * step(abs(d.x), arm)
    );
    ink = max(ink, max(ring, bars));
  }
  return ink;
}

void main() {
  vec2 px = vUv * uSize;
  vec2 center = uSize * 0.5;
  vec2 q = px - center - uOffset;
  float c = cos(uTurn);
  float s = sin(uTurn);
  q = mat2(c, -s, s, c) * q + center;

  float blue = max(coverage(px), marks(px));
  float pink = max(coverage(q), marks(q));
  // Riso ink: coverage breaks up a little, more on the lighter plate.
  float grain = cellHash(mod(floor(px / max(1.0, uPixel * 1.5)), 1024.0));
  pink *= 0.84 + 0.16 * grain;
  blue *= 0.95 + 0.05 * grain;

  // Subtractive inks on the page colour; output relative to a transparent canvas.
  vec3 printed = uPaper * mix(vec3(1.0), uBlue, blue) * mix(vec3(1.0), uPink, pink);
  float alpha = 1.0 - (1.0 - blue) * (1.0 - pink);
  gl_FragColor = vec4(max(printed - uPaper * (1.0 - alpha), 0.0), alpha);
}`;

export function RegisterTitle(props: RegisterTitleProps) {
  return (
    <WebGLSection target={props.target} name="register-title">
      <Plates {...props} />
    </WebGLSection>
  );
}

function Plates({
  target: id,
  progress,
  paper,
  blue,
  pink,
  store,
  labels = { off: "套准偏差", on: "已套准" },
}: RegisterTitleProps) {
  const runtime = useWebGLRuntime();
  const target = useDOMTarget(id);
  const { reducedMotion } = useRenderQuality();
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const [revision, setRevision] = useState(-1);
  const mask = useMemo(
    () =>
      revision >= 0 && target?.element
        ? createRegisterMask(target.element)
        : undefined,
    // `revision` is the rebuild signal; the element is read from the target.
    [revision, target],
  );
  useEffect(() => () => mask?.dispose(), [mask]);
  useEffect(() => {
    if (!target || !mask) return;
    runtime.setTargetReady(id, true, target);
    return () => runtime.setTargetReady(id, false, target);
  }, [runtime, target, mask, id]);

  const uniforms = useMemo(
    () => ({
      uMask: { value: mask?.texture ?? null },
      uSize: { value: mask?.size ?? new Vector2(1, 1) },
      uMargin: { value: mask?.margin ?? 0 },
      uOffset: { value: new Vector2() },
      uTurn: { value: 0 },
      uPaper: { value: cssRGB(paper) },
      uBlue: { value: cssRGB(blue) },
      uPink: { value: cssRGB(pink) },
      // Line width of the marks, in CSS pixels.
      uPixel: { value: 1 },
    }),
    [mask, paper, blue, pink],
  );
  const plate = useMemo(
    () => ({ offset: new Vector2(12, -8), turn: 0.008, shown: "", written: -Infinity }),
    [],
  );

  useFrame(({ camera, size, pointer, clock }, delta) => {
    const live = target;
    if (live && live.revision !== revision) setRevision(live.revision);
    const node = mesh.current;
    const values = material.current?.uniforms;
    if (!node || !values || !live || !mask || live.rect.width <= 0) return;
    const margin = mask.margin;
    coverRect(
      node,
      camera,
      {
        left: live.rect.left - margin,
        top: live.rect.top - margin,
        width: live.rect.width + margin * 2,
        height: live.rect.height + margin * 2,
      },
      size,
      planeDistance,
    );

    const span = Math.max(1e-6, progress.to - progress.from);
    const off = misregistration(
      (runtime.progress.get(progress.key) - progress.from) / span,
    );
    // Offsets scale with the heading so a small screen is not torn apart.
    const scale = Math.min(1.4, Math.max(0.45, live.rect.height / 200));
    const t = clock.elapsedTime;
    const motion = reducedMotion ? 0 : 1;
    const goalX = off * scale * (12 + motion * (Math.sin(t * 0.7) * 2.5 + pointer.x * 8));
    const goalY = off * scale * (-8 + motion * (Math.cos(t * 0.53) * 2 + pointer.y * 5));
    const goalTurn = off * (0.008 + motion * (Math.sin(t * 0.4) * 0.003 + pointer.x * 0.004));
    plate.offset.set(
      damp(plate.offset.x, goalX, 0.22, delta),
      damp(plate.offset.y, goalY, 0.22, delta),
    );
    plate.turn = damp(plate.turn, goalTurn, 0.22, delta);
    values.uOffset.value.copy(plate.offset);
    values.uTurn.value = plate.turn;

    // Text changes cost a layout: write the readout at most ten times a second.
    if (store?.readout && t - plate.written >= 0.1) {
      // The turn moves the heading's ends further than its centre.
      const distance =
        plate.offset.length() + Math.abs(plate.turn) * live.rect.width * 0.5;
      const shown = distance < 0.05 ? "0.0" : distance.toFixed(1);
      if (shown !== plate.shown) {
        plate.shown = shown;
        plate.written = t;
        store.readout.textContent = `${shown} px`;
        if (store.status)
          store.status.textContent = shown === "0.0" ? labels.on : labels.off;
        store.readout.dataset.registered = String(shown === "0.0");
      }
    }
  });

  if (!mask) return null;
  return (
    // A new mask needs a new material: the renderer keeps the uniforms object
    // it compiled with.
    <mesh key={mask.texture.uuid} ref={mesh} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        premultipliedAlpha
      />
    </mesh>
  );
}
