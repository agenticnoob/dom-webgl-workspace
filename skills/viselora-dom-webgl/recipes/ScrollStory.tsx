// Recipe: scroll progress mapped to a deterministic scene state.
//
// - The scene is a pure function of progress: no clock, no accumulated deltas,
//   no damping. Scrolling back to a position restores exactly the same frame,
//   and a resize recomputes progress from the live layout.
// - Progress comes from the story section's live target rect, so content
//   before or after the story does not shift the chapters.
// - The story section is a WebGLTarget that is never marked ready: its DOM
//   always stays visible. With `frameloop: "demand"` the runtime wakes the
//   canvas on scroll and resize, so no frames are rendered while idle.
//
// Copy this file, edit `keyframes` and render <ScrollStoryScene> in `scene`.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Mesh, type MeshStandardMaterial } from "three";
import type { DOMTargetState } from "@viselora/dom-webgl";
import {
  useDOMTarget,
  WebGLRuntime,
  WebGLTarget,
} from "@viselora/dom-webgl/react";

export type StoryState = {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: number;
  color: string;
  cameraZ: number;
};

/** One keyframe per chapter; `at` is the story progress in [0, 1]. */
export const keyframes: readonly { at: number; state: StoryState }[] = [
  {
    at: 0,
    state: { position: [-1.4, 0, 0], rotation: [0, 0, 0], scale: 1, color: "#ff6b6b", cameraZ: 6 },
  },
  {
    at: 0.5,
    state: { position: [1.4, 0.3, 0], rotation: [0.8, 2.4, 0], scale: 1.3, color: "#4dabf7", cameraZ: 5 },
  },
  {
    at: 1,
    state: { position: [0, -0.2, 0], rotation: [1.6, 4.8, 0.6], scale: 0.8, color: "#51cf66", cameraZ: 4 },
  },
];

/**
 * 0 when the section's top reaches the viewport top, 1 when its bottom reaches
 * the viewport bottom. Clamped, so the first and last chapters hold their state.
 */
export function sectionProgress(
  rect: DOMTargetState["rect"],
  viewportHeight: number,
): number {
  const distance = rect.height - viewportHeight;
  if (distance <= 0) return rect.top <= 0 ? 1 : 0;
  return clamp01(-rect.top / distance);
}

const colors = keyframes.map((frame) => new Color(frame.state.color));

/** Writes the interpolated state into the caller's objects (no allocation). */
export function sampleStory(
  progress: number,
  out: { mesh: Mesh; material: MeshStandardMaterial; camera: { position: { z: number } } },
): void {
  const p = clamp01(progress);
  let index = 0;
  while (index < keyframes.length - 2 && p > keyframes[index + 1].at) index += 1;
  const from = keyframes[index];
  const to = keyframes[index + 1];
  const span = to.at - from.at;
  const t = smoothstep(span > 0 ? (p - from.at) / span : 1);
  const mix = (a: number, b: number) => a + (b - a) * t;
  const a = from.state;
  const b = to.state;
  out.mesh.position.set(
    mix(a.position[0], b.position[0]),
    mix(a.position[1], b.position[1]),
    mix(a.position[2], b.position[2]),
  );
  out.mesh.rotation.set(
    mix(a.rotation[0], b.rotation[0]),
    mix(a.rotation[1], b.rotation[1]),
    mix(a.rotation[2], b.rotation[2]),
  );
  out.mesh.scale.setScalar(mix(a.scale, b.scale));
  out.material.color.copy(colors[index]).lerp(colors[index + 1], t);
  out.camera.position.z = mix(a.cameraZ, b.cameraZ);
}

export function ScrollStoryScene({ targetId }: { targetId: string }) {
  const target = useDOMTarget(targetId);
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);

  useFrame(({ camera, size }) => {
    if (!mesh.current || !material.current) return;
    // With WebGLScrollRuntime + ScrollEffectSection, read
    // `runtime.progress.get(progressKey)` here instead; the mapping is the same.
    const progress = target ? sectionProgress(target.rect, size.height) : 0;
    sampleStory(progress, { mesh: mesh.current, material: material.current, camera });
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <mesh ref={mesh}>
        <torusKnotGeometry args={[1, 0.35, 160, 24]} />
        <meshStandardMaterial ref={material} roughness={0.35} />
      </mesh>
    </>
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

const chapter = { minHeight: "100vh", padding: "20vh 8vw", boxSizing: "border-box" } as const;

export function ScrollStoryExample() {
  return (
    <WebGLRuntime
      canvas={{ camera: { position: [0, 0, 6], fov: 45 }, frameloop: "demand" }}
      scene={<ScrollStoryScene targetId="story" />}
    >
      <main>
        <WebGLTarget id="story">
          <div>
            {["Arrival", "Turn", "Release"].map((title) => (
              <section key={title} style={chapter}>
                <h2>{title}</h2>
                <p>The scene is a function of how far this story is scrolled.</p>
              </section>
            ))}
          </div>
        </WebGLTarget>
      </main>
    </WebGLRuntime>
  );
}
