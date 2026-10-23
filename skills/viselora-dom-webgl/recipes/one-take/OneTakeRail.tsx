// Recipe R1: one-take camera rail and chapter transition veil.
//
// OneTakeRail moves the page's camera along a spline as a progress signal goes
// from 0 to 1, looking along a second spline. ChapterVeil covers the canvas
// with a cell dissolve around chapter boundaries.
//
// Budget at medium: OneTakeRail draws nothing. ChapterVeil draws one
// full-screen quad, only inside the boundary windows; it needs no quality
// scaling (one hash per pixel).
//
// - Pass module-level arrays for `path`, `look` and `boundaries`: new arrays
//   rebuild the curves.
// - Place lights and the environment outside sections; the rail itself is not
//   a section because the camera must always follow the page.
// - Reduced motion: the camera follows progress without easing and the veil
//   becomes a plain crossfade.
import { useFrame } from "@react-three/fiber";
import { useRenderQuality, useWebGLRuntime } from "@viselora/dom-webgl/react";
import { useMemo, useRef } from "react";
import {
  CatmullRomCurve3,
  Color,
  Vector3,
  type Mesh,
  type ShaderMaterial,
  type Vector3Tuple,
} from "three";

import { cellHash, clamp01, coverViewport, damp } from "./screenSpace";

export type OneTakeRailProps = {
  readonly progressKey: string;
  /** Camera positions, reached at evenly spaced progress; at least two. */
  readonly path: readonly Vector3Tuple[];
  /** Points the camera looks at, sampled at the same progress. */
  readonly look: readonly Vector3Tuple[];
  /** Easing time constant in seconds (default 0.12). */
  readonly smoothing?: number;
};

export function OneTakeRail({
  progressKey,
  path,
  look,
  smoothing = 0.12,
}: OneTakeRailProps) {
  const runtime = useWebGLRuntime();
  const { reducedMotion } = useRenderQuality();
  const curves = useMemo(
    () => ({
      path: new CatmullRomCurve3(path.map((point) => new Vector3(...point))),
      look: new CatmullRomCurve3(look.map((point) => new Vector3(...point))),
    }),
    [path, look],
  );
  const scratch = useMemo(
    () => ({ position: new Vector3(), target: new Vector3() }),
    [],
  );
  const eased = useRef<number | undefined>(undefined);

  // Before ordinary frames, so camera-attached layers read this frame's pose.
  useFrame(({ camera }, delta) => {
    const goal = clamp01(runtime.progress.get(progressKey));
    const current = eased.current ?? goal;
    eased.current = reducedMotion
      ? goal
      : damp(current, goal, smoothing, delta);
    // Parametric, not arc-length: point i is reached at progress i / (n - 1).
    curves.path.getPoint(eased.current, scratch.position);
    curves.look.getPoint(eased.current, scratch.target);
    camera.position.copy(scratch.position);
    camera.lookAt(scratch.target);
    camera.updateMatrixWorld();
  }, -1);
  return null;
}

const veilVertex = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const veilFragment = /* glsl */ `
uniform float uCoverage;
uniform float uSeed;
uniform float uCell;
uniform float uReduced;
uniform vec3 uColor;
uniform vec3 uAccent;
${cellHash}
void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  float threshold = cellHash(cell + uSeed);
  float filled = step(threshold, uCoverage);
  // Cells that just filled glow in the accent colour.
  float edge = filled * (1.0 - smoothstep(0.0, 0.12, uCoverage - threshold));
  vec3 color = mix(uColor, uAccent, edge * (1.0 - uReduced));
  float alpha = mix(filled, uCoverage, uReduced);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}`;

export type ChapterVeilProps = {
  readonly progressKey: string;
  /** Progress values where one chapter hands over to the next. */
  readonly boundaries: readonly number[];
  /** Window around each boundary, in progress units (default 0.06). */
  readonly width?: number;
  readonly color: string;
  readonly accent: string;
  /** Cell size in CSS pixels (default 14). */
  readonly cell?: number;
};

export function ChapterVeil({
  progressKey,
  boundaries,
  width = 0.06,
  color,
  accent,
  cell = 14,
}: ChapterVeilProps) {
  const runtime = useWebGLRuntime();
  const { reducedMotion } = useRenderQuality();
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  // Initial values only; per-frame writes go through the material's uniforms.
  const uniforms = useMemo(
    () => ({
      uCoverage: { value: 0 },
      uSeed: { value: 0 },
      uCell: { value: cell },
      uReduced: { value: 0 },
      uColor: { value: new Color(color) },
      uAccent: { value: new Color(accent) },
    }),
    [cell, color, accent],
  );

  useFrame(({ camera, gl, size }) => {
    const node = mesh.current;
    const live = material.current?.uniforms;
    if (!node || !live) return;
    const progress = runtime.progress.get(progressKey);
    let coverage = 0;
    let seed = 0;
    boundaries.forEach((boundary, index) => {
      const local = (progress - (boundary - width / 2)) / width;
      if (local <= 0 || local >= 1) return;
      const peak = 1 - Math.abs(local * 2 - 1);
      if (peak > coverage) {
        coverage = peak;
        seed = index * 17.3;
      }
    });
    // Outside the windows nothing is drawn at all.
    node.visible = coverage > 0.001;
    if (!node.visible) return;
    coverViewport(node, camera, size, camera.near * 2);
    live.uCoverage.value = Math.min(1, coverage * 1.15);
    live.uSeed.value = seed;
    live.uCell.value = cell * gl.getPixelRatio();
    live.uReduced.value = reducedMotion ? 1 : 0;
  });

  return (
    <mesh ref={mesh} visible={false} renderOrder={1000} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={veilVertex}
        fragmentShader={veilFragment}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
