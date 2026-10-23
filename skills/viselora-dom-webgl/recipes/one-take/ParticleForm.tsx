// Recipe R4: particles that morph between shapes with scroll and part around
// the pointer.
//
// Shapes are sampled once at the highest particle count; the quality tier only
// changes the draw range (120k / 60k / 25k), so no buffer is rebuilt. Morph
// weights and the pointer are uniforms: no per-frame buffer upload and no
// pixel readback.
//
// Budget at medium: 1 draw call, 60k points, additive blending.
//
// - The component is a progress section over `progress`; outside it neither
//   updates nor draws.
// - `textShape(targetId)` samples the glyphs of a registered DOM target, so
//   the text stays real, selectable DOM.
// - Reduced motion: no drift and no pointer push; the morph follows scroll.
import { useFrame } from "@react-three/fiber";
import { drawDOMText, measureDOMText } from "@viselora/dom-webgl";
import {
  WebGLSection,
  useRenderQuality,
  useWebGLRuntime,
  type RuntimeManager,
  type WebGLSectionProgressRange,
} from "@viselora/dom-webgl/react";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  Plane,
  Raycaster,
  TorusKnotGeometry,
  Vector2,
  Vector3,
  type Group,
  type Points,
  type ShaderMaterial,
  type Vector3Tuple,
} from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

import { damp } from "./screenSpace";

/** Fills `count` xyz positions; `random` is deterministic per shape. */
export type ParticleShape = (
  count: number,
  random: () => number,
  runtime: Pick<RuntimeManager, "getTarget">,
) => Float32Array;

export const sphereShape =
  (radius = 2.2): ParticleShape =>
  (count, random) => {
    const out = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const r = radius * (0.92 + random() * 0.08);
      out[index * 3] = r * Math.sin(phi) * Math.cos(theta);
      out[index * 3 + 1] = r * Math.cos(phi);
      out[index * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return out;
  };

export const torusKnotShape =
  (radius = 1.6): ParticleShape =>
  (count) => {
    const geometry = new TorusKnotGeometry(radius, radius * 0.28, 220, 24);
    // Sampled with Math.random: the typings do not declare a seeded generator.
    const sampler = new MeshSurfaceSampler(new Mesh(geometry)).build();
    const out = new Float32Array(count * 3);
    const point = new Vector3();
    for (let index = 0; index < count; index += 1) {
      sampler.sample(point);
      point.toArray(out, index * 3);
    }
    geometry.dispose();
    return out;
  };

/** Glyph pixels of a registered DOM target, `width` world units wide. */
export const textShape =
  (targetId: string, width = 5.5): ParticleShape =>
  (count, random, runtime) => {
    const element = runtime.getTarget(targetId)?.element;
    if (!element) return sphereShape()(count, random, runtime);
    const layout = measureDOMText(element, { devicePixelRatio: 1 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(layout.width));
    canvas.height = Math.max(1, Math.ceil(layout.height));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return sphereShape()(count, random, runtime);
    drawDOMText(context, layout);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const filled: number[] = [];
    for (let index = 0; index < data.length / 4; index += 1)
      if (data[index * 4 + 3] > 128) filled.push(index);
    const out = new Float32Array(count * 3);
    if (filled.length === 0) return sphereShape()(count, random, runtime);
    // Fit the glyphs themselves, not the element box, to `width`.
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const pixel of filled) {
      const x = pixel % canvas.width;
      const y = Math.floor(pixel / canvas.width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const scale = width / Math.max(1, maxX - minX + 1);
    const centerX = (minX + maxX + 1) / 2;
    const centerY = (minY + maxY + 1) / 2;
    for (let index = 0; index < count; index += 1) {
      const pixel = filled[Math.floor(random() * filled.length)];
      const x = (pixel % canvas.width) + random();
      const y = Math.floor(pixel / canvas.width) + random();
      out[index * 3] = (x - centerX) * scale;
      out[index * 3 + 1] = (centerY - y) * scale;
      out[index * 3 + 2] = (random() - 0.5) * 0.25;
    }
    return out;
  };

const maxShapes = 4;
const countByTier = { high: 120_000, medium: 60_000, low: 25_000 } as const;
const maxCount = countByTier.high;

const particleVertex = /* glsl */ `
uniform vec4 uWeights;
uniform vec3 uPointer;
uniform float uPush;
uniform float uTime;
uniform float uDrift;
uniform float uPixelRatio;
uniform float uSize;
attribute vec3 aShape0;
attribute vec3 aShape1;
attribute vec3 aShape2;
attribute vec3 aShape3;
attribute float aSeed;
varying float vGlow;
void main() {
  vec3 p = aShape0 * uWeights.x + aShape1 * uWeights.y + aShape2 * uWeights.z + aShape3 * uWeights.w;
  float phase = aSeed * 6.2831853;
  p += uDrift * 0.06 * vec3(sin(uTime * 0.7 + phase), cos(uTime * 0.6 + phase * 1.3), sin(uTime * 0.5 + phase * 0.7));
  vec2 away = p.xy - uPointer.xy;
  float distance = length(away);
  float push = uPush * smoothstep(1.4, 0.0, distance);
  p.xy += normalize(away + 1e-4) * push * 0.9;
  vGlow = push;
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = uSize * (0.6 + aSeed * 0.8) * uPixelRatio * (10.0 / max(-view.z, 0.1));
}`;

const particleFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uOpacity;
varying float vGlow;
void main() {
  float alpha = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * uOpacity;
  vec3 color = mix(uColor, uAccent, clamp(vGlow, 0.0, 1.0));
  gl_FragColor = vec4(color * alpha, alpha);
}`;

export type ParticleFormProps = {
  /** Progress range over which the shapes morph in order. */
  readonly progress: WebGLSectionProgressRange;
  /** Two to four shapes; pass a module-level array. */
  readonly shapes: readonly ParticleShape[];
  readonly position?: Vector3Tuple;
  readonly color: string;
  readonly accent: string;
  /** Point size scale (default 1). */
  readonly size?: number;
};

export function ParticleForm(props: ParticleFormProps) {
  return (
    <WebGLSection progress={props.progress} name="particle-form">
      <ParticleField {...props} />
    </WebGLSection>
  );
}

function ParticleField({
  progress,
  shapes,
  position = [0, 0, 0],
  color,
  accent,
  size = 1,
}: ParticleFormProps) {
  const runtime = useWebGLRuntime();
  const { tier, reducedMotion } = useRenderQuality();
  const group = useRef<Group>(null);
  const points = useRef<Points>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const created = new BufferGeometry();
    const random = createRandom(0x51a7e);
    const sampled = shapes
      .slice(0, maxShapes)
      .map((shape) => shape(maxCount, random, runtime));
    for (let index = 0; index < maxShapes; index += 1) {
      const data = sampled[index] ?? sampled[sampled.length - 1];
      created.setAttribute(`aShape${index}`, new BufferAttribute(data, 3));
    }
    // `position` only sizes the draw call and bounds; the shader morphs.
    created.setAttribute("position", new BufferAttribute(sampled[0], 3));
    const seeds = new Float32Array(maxCount);
    for (let index = 0; index < maxCount; index += 1) seeds[index] = random();
    created.setAttribute("aSeed", new BufferAttribute(seeds, 1));
    return created;
  }, [shapes, runtime]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(
    () => ({
      uWeights: { value: [1, 0, 0, 0] },
      uPointer: { value: new Vector3(99, 99, 0) },
      uPush: { value: 0 },
      uTime: { value: 0 },
      uDrift: { value: 1 },
      uPixelRatio: { value: 1 },
      uSize: { value: size },
      uOpacity: { value: 1 },
      uColor: { value: new Color(color) },
      uAccent: { value: new Color(accent) },
    }),
    [size, color, accent],
  );
  const pointer = useMemo(
    () => ({
      raycaster: new Raycaster(),
      plane: new Plane(),
      hit: new Vector3(),
      origin: new Vector3(),
      ndc: new Vector2(),
      push: 0,
    }),
    [],
  );

  useFrame(({ camera, clock, gl, pointer: ndc }, delta) => {
    const live = material.current?.uniforms;
    const node = group.current;
    if (!live || !node || !points.current) return;
    geometry.setDrawRange(0, countByTier[tier]);
    const span = Math.max(1e-6, progress.to - progress.from);
    const local = Math.min(
      1,
      Math.max(0, (runtime.progress.get(progress.key) - progress.from) / span),
    );
    const steps = Math.min(shapes.length, maxShapes) - 1;
    // The last shape holds for the final 30%, clear of chapter transitions.
    const position = Math.min(1, local / 0.7) * steps;
    const index = Math.min(steps - 1, Math.floor(position));
    const fraction = smooth(position - index);
    const weights = [0, 0, 0, 0];
    weights[Math.max(0, index)] = 1 - fraction;
    weights[Math.max(0, index) + 1] = fraction;
    live.uWeights.value = weights;
    // Pointer on the form's plane, in its local space.
    node.updateWorldMatrix(true, false);
    pointer.plane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(pointer.hit).negate(),
      node.getWorldPosition(pointer.origin),
    );
    pointer.ndc.set(ndc.x, ndc.y);
    pointer.raycaster.setFromCamera(pointer.ndc, camera);
    const hit = pointer.raycaster.ray.intersectPlane(
      pointer.plane,
      pointer.hit,
    );
    const active = hit !== null && !reducedMotion;
    pointer.push = damp(pointer.push, active ? 1 : 0, 0.25, delta);
    if (hit) live.uPointer.value.copy(node.worldToLocal(hit));
    live.uPush.value = pointer.push;
    live.uTime.value = clock.elapsedTime;
    live.uDrift.value = reducedMotion ? 0 : 1;
    live.uPixelRatio.value = gl.getPixelRatio();
    // Fade at the ends of the range, except at the ends of the page.
    live.uOpacity.value = Math.min(
      1,
      progress.from <= 0 ? 1 : local * 8,
      progress.to >= 1 ? 1 : (1 - local) * 8,
    );
  });

  return (
    <group ref={group} position={position}>
      <points ref={points} geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={particleVertex}
          fragmentShader={particleFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

function smooth(value: number) {
  return value * value * (3 - 2 * value);
}

// Mulberry32: deterministic so every visit samples the same field.
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
