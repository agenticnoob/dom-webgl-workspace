// Site diagram: a page drawn as three printing plates that separate and close
// again while their block is pinned.
//
// The WebGL plate holds halftone fills, the runtime plate registration ticks
// and targets, the DOM plate outlines and text bars. Flat, they overprint into
// one small page; separated, they show which layer owns what.
//
// Budget: five draw calls (fills, two line sets, text bars, labels), all
// geometry built once from normalized boxes.
//
// - It is a target section placed over the target's rect.
// - Reduced motion: the stack holds its separated pose instead of moving.
import { useFrame } from "@react-three/fiber";
import {
  WebGLSection,
  useDOMTarget,
  useRenderQuality,
  useWebGLRuntime,
  type WebGLSectionProgressRange,
} from "@viselora/dom-webgl/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  Euler,
  Float32BufferAttribute,
  LinearFilter,
  Quaternion,
  SRGBColorSpace,
  Vector2,
  type Group,
  type ShaderMaterial,
} from "three";

import { cssRGB } from "./RegisterTitle";
import { clamp01, coverRect, damp } from "../showcase/screenSpace";

export type LayerStackProps = {
  readonly target: string;
  readonly progress: WebGLSectionProgressRange;
  readonly paper: string;
  readonly colors: {
    readonly dom: string;
    readonly runtime: string;
    readonly webgl: string;
  };
  /** Plate labels, bottom plate first: WebGL, runtime, DOM. */
  readonly labels: readonly [string, string, string];
};

/** A box in the plate's unit square: x right, y down, from its top-left. */
type Box = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

const title: Box = { x: 0.1, y: 0.12, w: 0.5, h: 0.16 };
const lines: readonly Box[] = [
  { x: 0.1, y: 0.36, w: 0.42, h: 0.03 },
  { x: 0.1, y: 0.42, w: 0.38, h: 0.03 },
  { x: 0.1, y: 0.48, w: 0.3, h: 0.03 },
];
const image: Box = { x: 0.6, y: 0.34, w: 0.3, h: 0.28 };
const cards: readonly Box[] = [0, 1, 2].map((index) => ({
  x: 0.1 + index * 0.27,
  y: 0.7,
  w: 0.23,
  h: 0.16,
}));
const blocks = [title, image, ...cards];
const plateDistance = 6;

/** Separation for a local progress: opens, holds, then closes into register. */
export function stackSeparation(local: number) {
  const smooth = (edge0: number, edge1: number, value: number) => {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };
  return smooth(0.06, 0.36, local) * (1 - smooth(0.66, 0.94, local));
}

// Unit square centred on the origin, y up.
const point = (x: number, y: number) => [x - 0.5, 0.5 - y, 0] as const;

function outline(box: Box) {
  const a = point(box.x, box.y);
  const b = point(box.x + box.w, box.y);
  const c = point(box.x + box.w, box.y + box.h);
  const d = point(box.x, box.y + box.h);
  return [...a, ...b, ...b, ...c, ...c, ...d, ...d, ...a];
}

function quad(box: Box) {
  const a = point(box.x, box.y);
  const b = point(box.x + box.w, box.y);
  const c = point(box.x + box.w, box.y + box.h);
  const d = point(box.x, box.y + box.h);
  return [...a, ...d, ...b, ...b, ...d, ...c];
}

/** Corner ticks and a centred target per block: what the runtime measures. */
function registration(box: Box, aspect: number) {
  const tick = 0.035;
  const out: number[] = [];
  const corners: readonly [number, number, number, number][] = [
    [box.x, box.y, 1, 1],
    [box.x + box.w, box.y, -1, 1],
    [box.x + box.w, box.y + box.h, -1, -1],
    [box.x, box.y + box.h, 1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    out.push(...point(x - sx * 0.012, y), ...point(x - sx * (0.012 + tick), y));
    out.push(...point(x, y - sy * 0.012 * aspect), ...point(x, y - sy * (0.012 + tick) * aspect));
  }
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const radius = 0.018;
  const steps = 20;
  for (let step = 0; step < steps; step += 1) {
    const a0 = (step / steps) * Math.PI * 2;
    const a1 = ((step + 1) / steps) * Math.PI * 2;
    out.push(
      ...point(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius * aspect),
      ...point(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius * aspect),
    );
  }
  out.push(...point(cx - radius * 1.8, cy), ...point(cx + radius * 1.8, cy));
  out.push(...point(cx, cy - radius * 1.8 * aspect), ...point(cx, cy + radius * 1.8 * aspect));
  return out;
}

function geometry(positions: readonly number[], density?: readonly number[]) {
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(positions, 3));
  if (density) result.setAttribute("aDensity", new Float32BufferAttribute(density, 1));
  return result;
}

/** Builds every plate's geometry for a stage of the given aspect (w / h). */
export function createStackGeometry(aspect: number) {
  const plateFrame = outline({ x: 0, y: 0, w: 1, h: 1 });
  // Halftone density per fill: the plate itself is light, blocks are dense.
  const fills: number[] = [];
  const density: number[] = [];
  const fill = (box: Box, amount: number) => {
    const positions = quad(box);
    fills.push(...positions);
    for (let index = 0; index < positions.length / 3; index += 1) density.push(amount);
  };
  fill({ x: 0, y: 0, w: 1, h: 1 }, 0.08);
  fill(title, 0.85);
  fill(image, 0.55);
  for (const card of cards) fill(card, 0.4);
  const ticks = [...plateFrame];
  // Ticks are drawn in a unit square; keep their arms equal on screen.
  for (const box of blocks) ticks.push(...registration(box, aspect));
  const outlines = [...plateFrame];
  for (const box of [image, ...cards]) outlines.push(...outline(box));
  const bars: number[] = [];
  for (const box of [title, ...lines]) bars.push(...quad(box));
  const shapes = {
    fills: geometry(fills, density),
    ticks: geometry(ticks),
    outlines: geometry(outlines),
    bars: geometry(bars),
  };
  return {
    ...shapes,
    dispose() {
      for (const shape of Object.values(shapes)) shape.dispose();
    },
  };
}

const halftoneVertex = /* glsl */ `
attribute float aDensity;
varying float vDensity;
varying vec2 vPlate;
void main() {
  vDensity = aDensity;
  vPlate = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const halftoneFragment = /* glsl */ `
uniform vec3 uInk;
uniform vec2 uDots;
uniform float uOpacity;
varying float vDensity;
varying vec2 vPlate;
void main() {
  // A dot screen in plate space: it tilts with the plate like printed ink.
  vec2 cell = fract(vPlate * uDots) - 0.5;
  float radius = sqrt(vDensity) * 0.56;
  float edge = fwidth(length(cell)) * 1.2;
  float dot = 1.0 - smoothstep(radius - edge, radius + edge, length(cell));
  // A faint wash under the dots, like ink picked up by the whole plate.
  float alpha = (dot + (1.0 - dot) * 0.06) * uOpacity;
  gl_FragColor = vec4(uInk * alpha, alpha);
}`;

const flatFragment = /* glsl */ `
uniform vec3 uInk;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(uInk * uOpacity, uOpacity);
}`;

const flatVertex = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const labelVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const labelFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 text = texture2D(uMap, vUv);
  float alpha = text.a * uOpacity;
  gl_FragColor = vec4(text.rgb * alpha, alpha);
  #include <colorspace_fragment>
}`;

/** One label texture per plate; returns the texture and its aspect. */
function createLabel(text: string, color: string, font: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const height = 64;
  if (!context) return undefined;
  context.font = `500 ${height * 0.5}px ${font}`;
  const width = Math.ceil(context.measureText(text).width + height * 0.2);
  canvas.width = width;
  canvas.height = height;
  context.font = `500 ${height * 0.5}px ${font}`;
  context.fillStyle = color;
  context.textBaseline = "middle";
  context.fillText(text, height * 0.1, height * 0.52);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { texture, aspect: width / height };
}

export function LayerStack(props: LayerStackProps) {
  return (
    <WebGLSection target={props.target} name="layer-stack">
      <Stack {...props} />
    </WebGLSection>
  );
}

function Stack({ target: id, progress, colors, labels }: LayerStackProps) {
  const runtime = useWebGLRuntime();
  const target = useDOMTarget(id);
  const { reducedMotion } = useRenderQuality();
  const root = useRef<Group>(null);
  const plates = useRef<(Group | null)[]>([]);
  const labelMaterials = useRef<(ShaderMaterial | null)[]>([]);
  const aspect = target && target.rect.height > 0 ? target.rect.width / target.rect.height : 4 / 3;
  // Rebuilt only when the stage changes shape noticeably.
  const bucket = Math.round(aspect * 10) / 10;
  const shapes = useMemo(() => createStackGeometry(bucket), [bucket]);
  useEffect(() => () => shapes.dispose(), [shapes]);

  // Labels are drawn with the page's mono face once it has loaded.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) setFontsReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  const [webglLabel, runtimeLabel, domLabel] = labels;
  const labelTextures = useMemo(() => {
    const font = fontsReady ? "'Geist Mono', ui-monospace, monospace" : "ui-monospace, monospace";
    return [
      createLabel(webglLabel, colors.webgl, font),
      createLabel(runtimeLabel, colors.runtime, font),
      createLabel(domLabel, colors.dom, font),
    ];
  }, [fontsReady, webglLabel, runtimeLabel, domLabel, colors.webgl, colors.runtime, colors.dom]);
  useEffect(
    () => () => {
      for (const label of labelTextures) label?.texture.dispose();
    },
    [labelTextures],
  );
  useEffect(() => {
    if (!target) return;
    runtime.setTargetReady(id, true, target);
    return () => runtime.setTargetReady(id, false, target);
  }, [runtime, target, id]);

  const materials = useMemo(
    () => ({
      fill: {
        uInk: { value: cssRGB(colors.webgl) },
        uDots: { value: new Vector2(48, 36) },
        uOpacity: { value: 1 },
      },
      ticks: { uInk: { value: cssRGB(colors.runtime) }, uOpacity: { value: 1 } },
      outlines: { uInk: { value: cssRGB(colors.dom) }, uOpacity: { value: 1 } },
      bars: { uInk: { value: cssRGB(colors.dom) }, uOpacity: { value: 0.9 } },
    }),
    [colors.webgl, colors.runtime, colors.dom],
  );
  const labelUniforms = useMemo(
    () =>
      labelTextures.map((label) => ({
        uMap: { value: label?.texture ?? null },
        uOpacity: { value: 0 },
      })),
    [labelTextures],
  );
  const pose = useMemo(
    () => ({ open: 0, euler: new Euler(), turn: new Quaternion() }),
    [],
  );

  useFrame(({ camera, size, clock }, delta) => {
    const node = root.current;
    if (!node || !target || target.rect.width <= 0) return;
    coverRect(node, camera, target.rect, size, plateDistance);
    const span = Math.max(1e-6, progress.to - progress.from);
    const local = (runtime.progress.get(progress.key) - progress.from) / span;
    const goal = reducedMotion ? 1 : stackSeparation(local);
    pose.open = damp(pose.open, goal, reducedMotion ? 0 : 0.12, delta);
    const open = pose.open;
    // Spin in the page, then tilt back: an exploded axonometric view.
    pose.euler.set(-0.95 * open, 0, -0.55 * open, "XYZ");
    pose.turn.setFromEuler(pose.euler);
    node.quaternion.multiply(pose.turn);
    const shrink = 1 - 0.22 * open;
    node.scale.multiplyScalar(shrink);
    node.scale.z = 1;
    const height = node.scale.y;
    const drift = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.8) * 0.04;
    plates.current.forEach((plate, index) => {
      if (!plate) return;
      plate.position.z = (index - 1) * height * (0.42 + drift) * open;
    });
    materials.fill.uDots.value.set(72, 72 / Math.max(0.2, bucket));
    for (const label of labelMaterials.current)
      if (label) label.uniforms.uOpacity.value = clamp01(open * 1.4 - 0.2);
  });

  const labelHeight = 0.07;
  return (
    <group ref={root}>
      {[0, 1, 2].map((index) => (
        <group
          key={index}
          ref={(node) => {
            plates.current[index] = node;
          }}
        >
          {index === 0 ? (
            <mesh geometry={shapes.fills} renderOrder={1} frustumCulled={false}>
              <shaderMaterial
                uniforms={materials.fill}
                vertexShader={halftoneVertex}
                fragmentShader={halftoneFragment}
                transparent
                depthWrite={false}
                depthTest={false}
                premultipliedAlpha
              />
            </mesh>
          ) : null}
          {index === 1 ? (
            <lineSegments geometry={shapes.ticks} renderOrder={2} frustumCulled={false}>
              <shaderMaterial
                uniforms={materials.ticks}
                vertexShader={flatVertex}
                fragmentShader={flatFragment}
                transparent
                depthWrite={false}
                depthTest={false}
                premultipliedAlpha
              />
            </lineSegments>
          ) : null}
          {index === 2 ? (
            <>
              <lineSegments geometry={shapes.outlines} renderOrder={3} frustumCulled={false}>
                <shaderMaterial
                  uniforms={materials.outlines}
                  vertexShader={flatVertex}
                  fragmentShader={flatFragment}
                  transparent
                  depthWrite={false}
                  depthTest={false}
                  premultipliedAlpha
                />
              </lineSegments>
              <mesh geometry={shapes.bars} renderOrder={3} frustumCulled={false}>
                <shaderMaterial
                  uniforms={materials.bars}
                  vertexShader={flatVertex}
                  fragmentShader={flatFragment}
                  transparent
                  depthWrite={false}
                  depthTest={false}
                  premultipliedAlpha
                />
              </mesh>
            </>
          ) : null}
          {labelTextures[index] ? (
            // Keyed by texture: the renderer keeps the uniforms it compiled with.
            <mesh
              key={labelTextures[index].texture.uuid}
              renderOrder={4}
              frustumCulled={false}
              position={[
                -0.5 + (labelHeight * labelTextures[index].aspect) / bucket / 2,
                0.5 + labelHeight * 0.75,
                0,
              ]}
              scale={[(labelHeight * labelTextures[index].aspect) / bucket, labelHeight, 1]}
            >
              <planeGeometry args={[1, 1]} />
              <shaderMaterial
                ref={(material) => {
                  labelMaterials.current[index] = material;
                }}
                uniforms={labelUniforms[index]}
                vertexShader={labelVertex}
                fragmentShader={labelFragment}
                transparent
                depthWrite={false}
                depthTest={false}
                premultipliedAlpha
              />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}
