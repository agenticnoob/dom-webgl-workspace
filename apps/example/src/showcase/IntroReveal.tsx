// Recipe R2: intro reveal. A veil in the page colour covers the canvas until
// `start`, then clears cell by cell from the centre and unmounts itself. The
// semantic DOM above the canvas is never covered.
//
// Budget at medium: one full-screen quad during the reveal, none afterwards.
//
// - Start it when the first scene can draw, for example when that scene's
//   `useSectionState().warmed` is true, so the reveal never uncovers an empty
//   canvas.
// - Reduced motion: a 0.25 s fade instead of the cell sweep.
import { useFrame } from "@react-three/fiber";
import { useRenderQuality } from "@viselora/dom-webgl/react";
import { useMemo, useRef, useState } from "react";
import { Color, type Mesh, type ShaderMaterial } from "three";

import { cellHash, coverViewport } from "./screenSpace";

const revealVertex = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const revealFragment = /* glsl */ `
uniform float uProgress;
uniform float uCell;
uniform float uReduced;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform vec3 uAccent;
${cellHash}
void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec2 center = uResolution / uCell * 0.5;
  float distance = length(cell - center) / max(length(center), 1.0);
  float threshold = distance * 0.75 + cellHash(cell) * 0.25;
  float open = step(threshold, uProgress);
  float edge = (1.0 - open) * smoothstep(threshold - 0.08, threshold, uProgress);
  vec3 color = mix(uColor, uAccent, edge);
  float alpha = mix(1.0 - open, 1.0 - uProgress, uReduced);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}`;

export type IntroRevealProps = {
  /** Begin clearing; keep the veil up until the first scene can draw. */
  readonly start: boolean;
  readonly color: string;
  readonly accent: string;
  /** Cell size in CSS pixels (default 18). */
  readonly cell?: number;
  /** Seconds (default 1.6). */
  readonly duration?: number;
  readonly onDone?: () => void;
};

export function IntroReveal({
  start,
  color,
  accent,
  cell = 18,
  duration = 1.6,
  onDone,
}: IntroRevealProps) {
  const { reducedMotion } = useRenderQuality();
  const [done, setDone] = useState(false);
  const progress = useRef(0);
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uCell: { value: cell },
      uReduced: { value: 0 },
      uResolution: { value: [1, 1] },
      uColor: { value: new Color(color) },
      uAccent: { value: new Color(accent) },
    }),
    [cell, color, accent],
  );

  useFrame(({ camera, gl, size }, delta) => {
    const node = mesh.current;
    const live = material.current?.uniforms;
    if (done || !node || !live) return;
    coverViewport(node, camera, size, camera.near * 2);
    const seconds = reducedMotion ? 0.25 : duration;
    if (start)
      progress.current = Math.min(1, progress.current + delta / seconds);
    const ratio = gl.getPixelRatio();
    live.uProgress.value = progress.current;
    live.uCell.value = cell * ratio;
    live.uReduced.value = reducedMotion ? 1 : 0;
    live.uResolution.value = [size.width * ratio, size.height * ratio];
    if (progress.current < 1) return;
    setDone(true);
    onDone?.();
  });

  if (done) return null;
  return (
    <mesh ref={mesh} renderOrder={999} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={revealVertex}
        fragmentShader={revealFragment}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
